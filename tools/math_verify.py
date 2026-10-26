#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SmartExam AI - SymPy Mathematical Verification Engine
Safely checks mathematical equivalence between student answers and teacher answer keys,
validates domain constraints, and simplifies mathematical expressions.
"""
import sys
import json
import re

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stdin, 'reconfigure'):
    sys.stdin.reconfigure(encoding='utf-8')

try:
    import sympy
    from sympy.parsing.latex import parse_latex
    from sympy.parsing.sympy_parser import (
        parse_expr,
        standard_transformations,
        implicit_multiplication_application,
        convert_xor,
    )
except ImportError as e:
    print(json.dumps({"valid": False, "error": f"SymPy not available: {e}"}))
    sys.exit(0)

TRANSFORMATIONS = standard_transformations + (
    implicit_multiplication_application,
    convert_xor,
)

def clean_input(s: str) -> str:
    if not s:
        return ""
    s = s.strip()
    # Strip optional wrapping dollar signs: $...$
    if s.startswith("$") and s.endswith("$") and len(s) >= 2:
        s = s[1:-1].strip()
    # Normalize double backslashes from JSON serialization e.g. \\frac -> \frac
    s = re.sub(r"\\\\+", r"\\", s)
    # Strip leading variable assignment like "x = ", "y = ", "S = "
    s = re.sub(r"^[a-zA-Z_]\s*=\s*", "", s)
    # Convert Vietnamese comma decimals e.g. 3,14 -> 3.14
    s = re.sub(r"(\d+),(\d+)", r"\1.\2", s)
    # Normalize common LaTeX unicode or spacing
    s = s.replace(r"\cdot", "*").replace(r"\times", "*")
    s = s.replace("−", "-").replace("–", "-")
    return s.strip()

def safe_parse(raw: str):
    cleaned = clean_input(raw)
    if not cleaned:
        return None, "Biểu thức rỗng"
    
    # Try LaTeX parsing first if backslashes or braces present
    if "\\" in cleaned or "{" in cleaned:
        try:
            expr = parse_latex(cleaned)
            return expr, None
        except Exception:
            pass

    # Try standard SymPy parsing
    try:
        # Convert ^ to ** for power
        py_math = cleaned.replace("^", "**")
        expr = parse_expr(py_math, transformations=TRANSFORMATIONS, evaluate=True)
        return expr, None
    except Exception:
        pass

    # Fallback: try LaTeX again
    try:
        expr = parse_latex(cleaned)
        return expr, None
    except Exception as e:
        return None, str(e)

def verify_equivalence(s1: str, s2: str) -> dict:
    e1, err1 = safe_parse(s1)
    if err1 or e1 is None:
        return {"valid": False, "equivalent": False, "error": f"Không đọc được biểu thức 1: {err1}"}

    e2, err2 = safe_parse(s2)
    if err2 or e2 is None:
        return {"valid": False, "equivalent": False, "error": f"Không đọc được biểu thức 2: {err2}"}

    try:
        # Check symbolic equality
        diff = sympy.simplify(e1 - e2)
        if diff == 0:
            return {
                "valid": True,
                "equivalent": True,
                "diff": "0",
                "expr1": str(e1),
                "expr2": str(e2),
            }
        
        # Check ratio equality if difference failed due to trig/complex constants
        try:
            ratio = sympy.simplify(e1 / e2)
            if ratio == 1:
                return {
                    "valid": True,
                    "equivalent": True,
                    "diff": "0",
                    "expr1": str(e1),
                    "expr2": str(e2),
                }
        except Exception:
            pass

        # Try numerical comparison if both evaluate to numbers
        try:
            n1 = complex(sympy.N(e1))
            n2 = complex(sympy.N(e2))
            if abs(n1 - n2) < 1e-9:
                return {
                    "valid": True,
                    "equivalent": True,
                    "diff": "0",
                    "numeric_match": True,
                    "expr1": str(e1),
                    "expr2": str(e2),
                }
        except Exception:
            pass

        return {
            "valid": True,
            "equivalent": False,
            "diff": str(diff),
            "expr1": str(e1),
            "expr2": str(e2),
        }
    except Exception as e:
        return {"valid": False, "equivalent": False, "error": str(e)}

def main():
    if len(sys.argv) < 2:
        # Read from stdin
        raw = sys.stdin.read().strip()
        if not raw:
            print(json.dumps({"valid": False, "error": "No input provided"}))
            return
        data = json.loads(raw)
    else:
        # Read from arg
        data = json.loads(sys.argv[1])

    mode = data.get("mode", "equivalent")
    if mode == "equivalent":
        res = verify_equivalence(data.get("expr1", ""), data.get("expr2", ""))
        print(json.dumps(res, ensure_ascii=False))
    elif mode == "validate":
        expr, err = safe_parse(data.get("expr", ""))
        if err or expr is None:
            print(json.dumps({"valid": False, "error": err}))
        else:
            print(json.dumps({
                "valid": True,
                "expr": str(expr),
                "latex": sympy.latex(expr),
                "is_number": bool(expr.is_number),
            }, ensure_ascii=False))
    else:
        print(json.dumps({"valid": False, "error": f"Unknown mode: {mode}"}))

if __name__ == "__main__":
    main()
