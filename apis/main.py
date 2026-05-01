import subprocess
import sys
import time
import signal
import os

# Define the scripts to run
SCRIPTS = [
    "geospatial_api.py",
    "redundancy_api.py",
    "priority_api.py"
]

processes = []

def signal_handler(sig, frame):
    print("\nShutting down all APIs...")
    for p in processes:
        p.terminate()
    sys.exit(0)

# Register the signal handler for Ctrl+C
signal.signal(signal.SIGINT, signal_handler)

def main():
    print("--- Infra_Pulse Unified API Starter ---")
    
    # Get the python executable path
    python_exe = sys.executable

    for script in SCRIPTS:
        print(f"Starting {script}...")
        # Use Popen to run processes in the background
        p = subprocess.Popen([python_exe, script])
        processes.append(p)
        # Brief sleep to stagger startup and avoid port binding race conditions
        time.sleep(1)

    print("\nAll APIs are running. Press Ctrl+C to stop all services.")
    
    # Keep the main process alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        signal_handler(None, None)

if __name__ == "__main__":
    main()
