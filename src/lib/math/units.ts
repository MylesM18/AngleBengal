import { createUnit } from "mathjs";

/**
 * mathjs 15 ships km/h but not the mph or kph spellings students actually
 * type (verified: evaluate("60 mph") throws "Undefined symbol mph").
 * Registration is a module side effect; the try/catch guards the "unit
 * already exists" error createUnit throws when hot reload or a second test
 * file re-imports this module.
 */
try {
  createUnit("mph", "1 mi/h");
} catch {
  // Already registered.
}
try {
  createUnit("kph", "1 km/h");
} catch {
  // Already registered.
}
