import subprocess
import sys

result = subprocess.run([sys.executable, "test.py"], capture_output=True, text=True, encoding="utf-8")

with open("run_output.txt", "w", encoding="utf-8") as f:
    f.write("=== STDOUT ===\n")
    f.write(result.stdout)
    f.write("\n=== STDERR ===\n")
    f.write(result.stderr)
    f.write(f"\n=== EXIT CODE: {result.returncode} ===\n")

print("Check run_output.txt")
