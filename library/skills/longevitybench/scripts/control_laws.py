"""Hallmark vector field as implemented in longevityclaw/control_laws.py.

biological_age in that file is a control cost on a made-up age curve.
It is not a clinical age.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from presets import (
    AGE_ORIGIN,
    AGE_SPAN,
    HALLMARK_RATES,
    HALLMARK_WEIGHTS,
    HALLMARKS,
    INTERVENTIONS,
    LIE_SCALE,
)


@dataclass
class BiologicalState:
    hallmarks: dict[str, float] = field(default_factory=dict)
    chronological_age: float = 0.0

    def __post_init__(self) -> None:
        for hallmark in HALLMARKS:
            self.hallmarks.setdefault(hallmark, 0.0)

    def as_vector(self) -> list[float]:
        return [self.hallmarks.get(hallmark, 0.0) for hallmark in HALLMARKS]

    def biological_age(self) -> float:
        total = sum(self.hallmarks.get(hallmark, 0) * HALLMARK_WEIGHTS.get(hallmark, 1.0) for hallmark in HALLMARKS)
        return self.chronological_age * (1 + total / len(HALLMARKS))

    def distance_to(self, other: BiologicalState) -> float:
        return math.sqrt(sum((left - right) ** 2 for left, right in zip(self.as_vector(), other.as_vector())))


@dataclass
class Intervention:
    key: str
    name: str
    display: str
    description: str
    effects: dict[str, float]
    confidence: float
    evidence_level: str
    drug_class: str

    def apply(self, state: BiologicalState, magnitude: float = 1.0) -> BiologicalState:
        updated = dict(state.hallmarks)
        for hallmark, effect in self.effects.items():
            if hallmark in updated:
                updated[hallmark] = max(0.0, min(1.0, updated[hallmark] + effect * magnitude))
        return BiologicalState(hallmarks=updated, chronological_age=state.chronological_age)


def known_interventions() -> dict[str, Intervention]:
    return {
        row["key"]: Intervention(
            key=row["key"],
            name=row["name"],
            display=row["display"],
            description=row["description"],
            effects=dict(row["effects"]),
            confidence=row["confidence"],
            evidence_level=row["evidence_level"],
            drug_class=row["drug_class"],
        )
        for row in INTERVENTIONS
    }


def create_typical_aging_state(chronological_age: float) -> BiologicalState:
    age_factor = max(0, min(1, (chronological_age - AGE_ORIGIN) / AGE_SPAN))
    hallmarks = {hallmark: age_factor * rate for hallmark, rate in HALLMARK_RATES.items()}
    return BiologicalState(hallmarks=hallmarks, chronological_age=chronological_age)


def compute_lie_bracket(left: Intervention, right: Intervention) -> dict[str, float]:
    bracket = {}
    for hallmark in HALLMARKS:
        interaction = left.effects.get(hallmark, 0.0) * right.effects.get(hallmark, 0.0) * LIE_SCALE
        if abs(interaction) > 0.001:
            bracket[hallmark] = interaction
    return bracket


def rank_interventions(state: BiologicalState, names: list[str] | None = None) -> list[tuple[str, float, float]]:
    table = known_interventions()
    chosen = names if names is not None else list(table)
    current = state.biological_age()
    ranked = []
    for name in chosen:
        if name not in table:
            continue
        intervention = table[name]
        reduction = current - intervention.apply(state).biological_age()
        ranked.append((name, reduction, intervention.confidence))
    ranked.sort(key=lambda item: item[1] * item[2], reverse=True)
    return ranked


def optimal_intervention_sequence(state: BiologicalState, names: list[str], max_steps: int = 10) -> list[str]:
    table = known_interventions()
    remaining = set(names)
    sequence: list[str] = []
    current = state
    for _ in range(min(max_steps, len(names))):
        if not remaining:
            break
        best_name = None
        best_reduction = -float("inf")
        for name in remaining:
            if name not in table:
                continue
            reduction = current.biological_age() - table[name].apply(current).biological_age()
            if reduction > best_reduction:
                best_reduction = reduction
                best_name = name
        if best_name is None or best_reduction <= 0:
            break
        sequence.append(best_name)
        remaining.remove(best_name)
        current = table[best_name].apply(current)
    return sequence


def control_law_analysis(chronological_age: float, names: list[str] | None = None) -> dict:
    state = create_typical_aging_state(chronological_age)
    table = known_interventions()
    chosen = names if names is not None else list(table)
    rankings = rank_interventions(state, chosen)
    return {
        "chronological_age": chronological_age,
        "initial_biological_age": state.biological_age(),
        "intervention_rankings": [
            {"key": name, "bio_age_reduction": reduction, "confidence": confidence}
            for name, reduction, confidence in rankings
        ],
        "optimal_sequence": optimal_intervention_sequence(state, chosen),
        "lie_example": compute_lie_bracket(table["rapamycin"], table["metformin"]),
    }
