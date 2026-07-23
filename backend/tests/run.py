"""Zero-dependency test runner.

Runs the scoring regression suite without needing pytest installed:

    cd backend && python3 -m tests.run       # or: python3 tests/run.py

Discovers every `test_*` function in the tests/test_*.py modules, runs it,
and reports PASS / FAIL / ERROR / SKIP. Exits non-zero if anything failed so
it works as a CI gate. pytest still works too (same files, plain asserts).
"""
from __future__ import annotations

import importlib
import os
import sys
import traceback

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

TEST_MODULES = [
    "tests.test_state_machine",
    "tests.test_scoring",
    "tests.test_llm_status",
    "tests.test_personas_live",
]


def _is_skip(exc: BaseException) -> bool:
    return type(exc).__name__ in ("Skipped", "OutcomeException")


def main() -> int:
    passed = failed = errored = skipped = 0
    failures: list[str] = []

    for modname in TEST_MODULES:
        mod = importlib.import_module(modname)
        fns = sorted(n for n in dir(mod) if n.startswith("test_") and callable(getattr(mod, n)))
        print(f"\n{modname}  ({len(fns)} tests)")
        for name in fns:
            try:
                getattr(mod, name)()
                print(f"  PASS  {name}")
                passed += 1
            except AssertionError as e:
                print(f"  FAIL  {name}: {e}")
                failures.append(f"{modname}.{name}: {e}")
                failed += 1
            except BaseException as e:  # noqa: BLE001
                if _is_skip(e):
                    print(f"  SKIP  {name}: {e}")
                    skipped += 1
                    continue
                print(f"  ERROR {name}: {e!r}")
                traceback.print_exc()
                failures.append(f"{modname}.{name}: {e!r}")
                errored += 1

    print(f"\n{'='*50}")
    print(f"passed={passed}  failed={failed}  errored={errored}  skipped={skipped}")
    if failures:
        print("\nFAILURES:")
        for f in failures:
            print(f"  - {f}")
    return 1 if (failed or errored) else 0


if __name__ == "__main__":
    sys.exit(main())
