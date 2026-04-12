"""Backward compatibility: use `python -m start_server [--generic]`."""

import runpy

if __name__ == "__main__":
    runpy.run_module("start_server", run_name="__main__", alter_sys=True)
