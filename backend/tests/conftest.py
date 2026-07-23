"""pytest bootstrap: put the backend package root on sys.path so the tests can
`import config` / `from services import ...` exactly like the app does.
(The zero-dependency runner in tests/run.py does the same.)
"""
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
