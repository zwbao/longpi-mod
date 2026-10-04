"""A small JSON Schema validator for the subset used in schema/*.json.

Supported keywords: $ref (local #/$defs/...), type, const, enum, properties,
required, additionalProperties, items, minItems, maxItems, uniqueItems,
minLength, maxLength, pattern, minimum, maximum, exclusiveMinimum,
exclusiveMaximum. Anything else in a schema is ignored, so keep the schema
files inside this subset.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List

_TYPES = {
    "object": lambda v: isinstance(v, dict),
    "array": lambda v: isinstance(v, list),
    "string": lambda v: isinstance(v, str),
    "boolean": lambda v: isinstance(v, bool),
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    "null": lambda v: v is None,
}


def _resolve(root: Dict[str, Any], ref: str) -> Dict[str, Any]:
    if not ref.startswith("#/"):
        raise ValueError(f"only local refs are supported: {ref}")
    node: Any = root
    for part in ref[2:].split("/"):
        node = node[part]
    return node


def validate(value: Any, schema: Dict[str, Any], root: Dict[str, Any] = None, path: str = "") -> List[str]:
    """Return a list of 'path: message' strings. Empty means valid."""
    root = root if root is not None else schema
    where = path or "/"
    if "$ref" in schema:
        return validate(value, _resolve(root, schema["$ref"]), root, path)
    errors: List[str] = []
    if "type" in schema:
        kinds = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(_TYPES[kind](value) for kind in kinds):
            return [f"{where}: expected {' or '.join(kinds)}, got {type(value).__name__}"]
    if "const" in schema and value != schema["const"]:
        errors.append(f"{where}: must be {json.dumps(schema['const'], ensure_ascii=False)}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{where}: {json.dumps(value, ensure_ascii=False)} is not one of {schema['enum']}")
    if isinstance(value, str):
        if "minLength" in schema and len(value) < schema["minLength"]:
            errors.append(f"{where}: shorter than {schema['minLength']} characters")
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            errors.append(f"{where}: longer than {schema['maxLength']} characters")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errors.append(f"{where}: {value!r} does not match {schema['pattern']}")
    if _TYPES["number"](value):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{where}: below minimum {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{where}: above maximum {schema['maximum']}")
        if "exclusiveMinimum" in schema and value <= schema["exclusiveMinimum"]:
            errors.append(f"{where}: must be greater than {schema['exclusiveMinimum']}")
        if "exclusiveMaximum" in schema and value >= schema["exclusiveMaximum"]:
            errors.append(f"{where}: must be less than {schema['exclusiveMaximum']}")
    if isinstance(value, list):
        if "minItems" in schema and len(value) < schema["minItems"]:
            errors.append(f"{where}: needs at least {schema['minItems']} items")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{where}: at most {schema['maxItems']} items")
        if schema.get("uniqueItems"):
            seen = []
            for item in value:
                marker = json.dumps(item, sort_keys=True, ensure_ascii=False)
                if marker in seen:
                    errors.append(f"{where}: duplicate item {marker}")
                seen.append(marker)
        if "items" in schema:
            for index, item in enumerate(value):
                errors += validate(item, schema["items"], root, f"{path}/{index}")
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                errors.append(f"{where}: missing required field {key}")
        properties = schema.get("properties", {})
        for key, item in value.items():
            if key in properties:
                errors += validate(item, properties[key], root, f"{path}/{key}")
                continue
            extra = schema.get("additionalProperties", True)
            if extra is False:
                errors.append(f"{where}: unknown field {key}")
            elif isinstance(extra, dict):
                errors += validate(item, extra, root, f"{path}/{key}")
    return errors
