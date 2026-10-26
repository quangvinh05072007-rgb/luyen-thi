#!/usr/bin/env python3
"""
SmartExam AI - High-Accuracy Optical Mark Recognition (OMR) Engine
Processes standardized 2025/2026 graduation exam bubble sheets and standard MCQ sheets.
Detects alignment markers, applies 4-point perspective warp, evaluates fill densities,
and flags blank, faint, or multiple-mark anomalies.
"""

import sys
import json
import base64
import os
import math

try:
    import cv2
    import numpy as np
except ImportError as err:
    print(json.dumps({"success": False, "error": f"Thiếu thư viện thị giác máy tính: {err}"}))
    sys.exit(0)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8")

TARGET_W = 1200
TARGET_H = 1700

# ---------------- Sheet Coordinate Map (Normalized 0.0 -> 1.0) ----------------
# Standard Vietnam 2025/2026 Form layout:
# Top: Student Code (SBD - 6 digits) & Exam Code (3 digits)
# Left: Part I (12 MCQ questions: 1..12, choices A, B, C, D)
# Middle: Part II (4 True/False questions: 1..4, sub-items a, b, c, d, choices Đ / S)
# Right: Part III (6 Short Answer questions: 1..6, +/- comma, 4 digit columns 0..9)

def find_sheet_corners(gray):
    """
    Finds 4 corner alignment markers or the outer sheet rectangle.
    """
    h, w = gray.shape
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 5
    )
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    marker_candidates = []
    min_area = (w * h) * 0.0001
    max_area = (w * h) * 0.02

    for c in contours:
        area = cv2.contourArea(c)
        if min_area < area < max_area:
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, 0.04 * peri, True)
            if len(approx) == 4:
                x, y, cw, ch = cv2.boundingRect(approx)
                aspect = float(cw) / max(1, ch)
                if 0.7 <= aspect <= 1.4:
                    marker_candidates.append((x + cw / 2.0, y + ch / 2.0))

    if len(marker_candidates) >= 4:
        # Sort into TL, TR, BR, BL
        pts = np.array(marker_candidates, dtype="float32")
        s = pts.sum(axis=1)
        diff = np.diff(pts, axis=1)

        tl = pts[np.argmin(s)]
        br = pts[np.argmax(s)]
        tr = pts[np.argmin(diff)]
        bl = pts[np.argmax(diff)]
        return np.array([tl, tr, br, bl], dtype="float32"), "markers"

    # Fallback: largest 4-sided contour
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    for c in contours[:5]:
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4 and cv2.contourArea(c) > (w * h * 0.3):
            pts = approx.reshape(4, 2).astype("float32")
            s = pts.sum(axis=1)
            diff = np.diff(pts, axis=1)
            return np.array([pts[np.argmin(s)], pts[np.argmin(diff)], pts[np.argmax(s)], pts[np.argmax(diff)]], dtype="float32"), "page"

    return np.array([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]], dtype="float32"), "page"

def warp_sheet(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else image
    corners, kind = find_sheet_corners(gray)
    if kind == "markers":
        dst = np.array(
            [[55.0, 55.0], [TARGET_W - 55.0, 55.0], [TARGET_W - 55.0, TARGET_H - 55.0], [55.0, TARGET_H - 55.0]],
            dtype="float32",
        )
    else:
        dst = np.array(
            [[0.0, 0.0], [TARGET_W - 1.0, 0.0], [TARGET_W - 1.0, TARGET_H - 1.0], [0.0, TARGET_H - 1.0]],
            dtype="float32",
        )
    M = cv2.getPerspectiveTransform(corners, dst)
    warped_color = cv2.warpPerspective(image, M, (TARGET_W, TARGET_H))
    warped_gray = cv2.cvtColor(warped_color, cv2.COLOR_BGR2GRAY) if len(image.shape) == 3 else warped_color
    return warped_color, warped_gray

def get_bubble_density(thresh, cx, cy, r):
    """
    Computes fill density inside circle (cx, cy) of radius r.
    Uses inner circle (0.65 * r) to avoid outer rim noise.
    """
    h, w = thresh.shape
    inner_r = max(2, int(r * 0.65))
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.circle(mask, (int(cx), int(cy)), inner_r, 255, -1)
    pts = cv2.countNonZero(mask)
    if pts == 0:
        return 0.0
    filled = cv2.countNonZero(cv2.bitwise_and(thresh, thresh, mask=mask))
    return float(filled) / float(pts)

def process_sheet(image_path_or_bytes):
    if isinstance(image_path_or_bytes, bytes):
        nparr = np.frombuffer(image_path_or_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    else:
        img = cv2.imread(image_path_or_bytes)

    if img is None:
        return {"success": False, "error": "Không thể mở file ảnh đề thi/phiếu trả lời."}

    warped, gray = warp_sheet(img)
    annotated = warped.copy()

    # Binarize with Otsu after slight blur
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)

    # 1. Read SBD (Số báo danh) - 6 columns of digits 0..9
    # Located in header box: x: 0.52 -> 0.76, y: 0.12 -> 0.28
    sbd_digits = []
    sbd_x0, sbd_y0 = 620, 200
    col_w, row_h = 32, 22
    bubble_r = 8

    for col in range(6):
        densities = []
        cx = sbd_x0 + col * col_w
        for row in range(10):
            cy = sbd_y0 + row * row_h
            d = get_bubble_density(thresh, cx, cy, bubble_r)
            densities.append((d, row, cx, cy))
        densities.sort(key=lambda x: x[0], reverse=True)
        top_d, top_row, best_cx, best_cy = densities[0]
        if top_d >= 0.28:
            sbd_digits.append(str(top_row))
            cv2.circle(annotated, (int(best_cx), int(best_cy)), bubble_r + 2, (0, 200, 0), 2)
        else:
            sbd_digits.append("?")

    student_code = "".join(sbd_digits)

    # 2. Read Exam Code (Mã đề) - 3 columns of digits 0..9
    # Located in header: x: 0.80 -> 0.94, y: 0.12 -> 0.28
    exam_digits = []
    ex_x0, ex_y0 = 960, 200
    for col in range(3):
        densities = []
        cx = ex_x0 + col * col_w
        for row in range(10):
            cy = ex_y0 + row * row_h
            d = get_bubble_density(thresh, cx, cy, bubble_r)
            densities.append((d, row, cx, cy))
        densities.sort(key=lambda x: x[0], reverse=True)
        top_d, top_row, best_cx, best_cy = densities[0]
        if top_d >= 0.28:
            exam_digits.append(str(top_row))
            cv2.circle(annotated, (int(best_cx), int(best_cy)), bubble_r + 2, (0, 200, 0), 2)
        else:
            exam_digits.append("?")
    exam_code = "".join(exam_digits)

    # 3. Read Part I: 12 MCQ questions (A, B, C, D)
    # Grid located at x: 80 -> 400, y: 550 -> 1050
    part_i_results = []
    p1_x0 = 120
    p1_y0 = 560
    p1_dx = 55
    p1_dy = 38
    choices = ["A", "B", "C", "D"]

    warnings_count = 0
    blank_count = 0
    multiple_count = 0

    for q_idx in range(12):
        cy = p1_y0 + q_idx * p1_dy
        densities = []
        coords = []
        for opt_idx in range(4):
            cx = p1_x0 + opt_idx * p1_dx
            d = get_bubble_density(thresh, cx, cy, 10)
            densities.append(d)
            coords.append((cx, cy))

        # Evaluate answer
        sorted_indices = sorted(range(4), key=lambda i: densities[i], reverse=True)
        best_i = sorted_indices[0]
        second_i = sorted_indices[1]
        best_d = densities[best_i]
        second_d = densities[second_i]

        selected = None
        label = None
        warning = None

        if best_d < 0.22:
            warning = "blank"
            blank_count += 1
            # Mark red dot for teacher attention
            cv2.circle(annotated, (coords[0][0] - 20, int(cy)), 4, (0, 0, 255), -1)
        elif second_d >= 0.30 and (second_d / max(0.01, best_d)) >= 0.65:
            selected = best_i
            label = choices[best_i]
            warning = "multiple"
            multiple_count += 1
            warnings_count += 1
            # Circle both in red
            cv2.circle(annotated, coords[best_i], 12, (0, 0, 255), 2)
            cv2.circle(annotated, coords[second_i], 12, (0, 0, 255), 2)
        elif best_d < 0.35:
            selected = best_i
            label = choices[best_i]
            warning = "faint"
            warnings_count += 1
            cv2.circle(annotated, coords[best_i], 12, (0, 165, 255), 2) # Orange for faint
        else:
            selected = best_i
            label = choices[best_i]
            cv2.circle(annotated, coords[best_i], 12, (0, 200, 0), 2) # Green for clean

        part_i_results.append({
            "q": q_idx + 1,
            "type": "mcq",
            "selected": selected,
            "label": label,
            "warning": warning,
            "densities": [round(d, 3) for d in densities],
        })

    # 4. Read Part II: 4 True/False questions (a, b, c, d with Đ / S)
    # Located at x: 440 -> 780, y: 560 -> 1050
    part_ii_results = []
    p2_x0 = 480
    p2_y0 = 560
    p2_row_gap = 110 # 4 sub questions per main question

    for q_idx in range(4):
        q_base_y = p2_y0 + q_idx * p2_row_gap
        sub_answers = []
        sub_warnings = []
        for sub_i in range(4):
            cy = q_base_y + sub_i * 24
            # Col 0 is Đ, Col 1 is S
            cx_d = p2_x0 + 80
            cx_s = p2_x0 + 125
            d_den = get_bubble_density(thresh, cx_d, cy, 8)
            s_den = get_bubble_density(thresh, cx_s, cy, 8)

            if max(d_den, s_den) < 0.22:
                sub_answers.append(None)
                sub_warnings.append("blank")
            elif min(d_den, s_den) >= 0.28 and (min(d_den, s_den) / max(0.01, max(d_den, s_den))) >= 0.65:
                sub_answers.append(d_den > s_den)
                sub_warnings.append("multiple")
                warnings_count += 1
                cv2.circle(annotated, (cx_d, int(cy)), 10, (0, 0, 255), 2)
                cv2.circle(annotated, (cx_s, int(cy)), 10, (0, 0, 255), 2)
            else:
                ans = d_den > s_den
                sub_answers.append(ans)
                warn = "faint" if max(d_den, s_den) < 0.35 else None
                if warn:
                    warnings_count += 1
                sub_warnings.append(warn)
                cv2.circle(
                    annotated,
                    (cx_d if ans else cx_s, int(cy)),
                    10,
                    (0, 165, 255) if warn else (0, 200, 0),
                    2,
                )

        part_ii_results.append({
            "q": q_idx + 1,
            "type": "tf",
            "selected": sub_answers,
            "warnings": sub_warnings,
        })

    # 5. Read Part III: 6 Short answers (1..6)
    # Located at x: 820 -> 1140, y: 560 -> 1100
    part_iii_results = []
    p3_x0 = 850
    p3_y0 = 560
    p3_q_gap = 75

    for q_idx in range(6):
        q_base_y = p3_y0 + q_idx * p3_q_gap
        # Columns: Sign/Point + 4 digits
        sign_d = get_bubble_density(thresh, p3_x0 + 20, q_base_y + 15, 7)
        # 4 digit columns
        parsed_chars = []
        is_negative = sign_d >= 0.30
        if is_negative:
            cv2.circle(annotated, (p3_x0 + 20, int(q_base_y + 15)), 8, (0, 200, 0), 2)

        for col in range(4):
            cx = p3_x0 + 55 + col * 26
            densities = []
            for row in range(10):
                cy = q_base_y + row * 12
                d = get_bubble_density(thresh, cx, cy, 6)
                densities.append((d, row, cx, cy))
            densities.sort(key=lambda x: x[0], reverse=True)
            top_d, top_row, best_cx, best_cy = densities[0]
            if top_d >= 0.28:
                parsed_chars.append(str(top_row))
                cv2.circle(annotated, (int(best_cx), int(best_cy)), 7, (0, 200, 0), 2)

        val_str = ("-" if is_negative else "") + "".join(parsed_chars)
        part_iii_results.append({
            "q": q_idx + 1,
            "type": "short",
            "value": val_str if parsed_chars else None,
            "warning": "blank" if not parsed_chars else None,
        })

    # Encode annotated image to JPEG base64 for teacher review side-by-side
    _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
    annotated_b64 = "data:image/jpeg;base64," + base64.b64encode(buf).decode("ascii")

    return {
        "success": True,
        "studentCode": student_code,
        "examCode": exam_code,
        "partI": part_i_results,
        "partII": part_ii_results,
        "partIII": part_iii_results,
        "summary": {
            "totalQuestions": 22,
            "answered": 22 - blank_count,
            "blank": blank_count,
            "warnings": warnings_count,
            "multiple": multiple_count,
        },
        "annotatedImage": annotated_b64,
    }

def main():
    if len(sys.argv) > 1 and sys.argv[1] != "-":
        target = sys.argv[1]
        res = process_sheet(target)
    else:
        # Read from stdin
        raw_bytes = sys.stdin.buffer.read()
        res = process_sheet(raw_bytes)
    print(json.dumps(res, ensure_ascii=False))

if __name__ == "__main__":
    main()
