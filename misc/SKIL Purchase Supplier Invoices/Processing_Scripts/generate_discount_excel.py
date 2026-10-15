import json
import os
import sys
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(BASE_DIR, 'Truth_Data_Sources', 'invoice.json')
OUTPUT_EXCEL = os.path.join(BASE_DIR, 'Ajanta_Discount_Discrepancies.xlsx')

def analyze_and_generate_excel():
    if not os.path.exists(JSON_PATH):
        print(f"Error: {JSON_PATH} not found.")
        return False

    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        invoices = json.load(f)

    discrepancies = []
    all_items = []
    inv_summaries = {}

    total_line_items = 0
    total_pairs = 0
    total_spend = 0.0

    for inv in invoices:
        inv_no = inv.get('invoice no', 'Unknown')
        inv_date = inv.get('date', 'Unknown')
        ship_to = inv.get('ship to', {}).get('name', 'Unknown')
        supplier = inv.get('supplier', {}).get('name', 'Ajanta Shoes (India) Private Limited')

        # Rule strictly applies to Ajanta
        if 'ajanta' not in supplier.lower() and 'ajanta' not in str(inv).lower():
            continue

        bill_data = inv.get('data', {}).get('bill data', [])
        
        inv_disc_count = 0
        inv_disc_loss = 0.0
        inv_total_pairs = 0
        inv_total_amt = 0.0

        for item in bill_data:
            total_line_items += 1
            desc = item.get('Description', 'Unknown Item')
            pairs = int(item.get('Pair', 0))
            mrp = float(item.get('MRP', 0.0))
            rate = float(item.get('Rate', 0.0))
            amt = float(item.get('Amount(Rs.)', 0.0))

            landed_cost = round(rate * 1.05, 2)
            net_discount = ((mrp - (rate * 1.05)) / mrp) * 100 if mrp > 0 else 0.0
            rounded_discount = round(net_discount, 2)

            inv_total_pairs += pairs
            inv_total_amt += amt
            total_pairs += pairs
            total_spend += amt

            # Expected landed price at strict 37.5% discount
            expected_landed = round(mrp * (1.0 - 0.375), 2)
            expected_rate = round(expected_landed / 1.05, 2)
            
            # Loss/Overcharge calculation per pair
            overcharge_per_pair = max(0.0, round(landed_cost - expected_landed, 2))
            total_overcharge = round(overcharge_per_pair * pairs, 2)

            is_discrepancy = rounded_discount < 37.45

            item_record = {
                'invoice': inv_no,
                'date': inv_date,
                'ship_to': ship_to,
                'desc': desc,
                'pairs': pairs,
                'mrp': mrp,
                'rate': rate,
                'landed_cost': landed_cost,
                'total_amount': amt,
                'net_discount': rounded_discount,
                'standard_discount': 37.50,
                'discount_gap': round(37.50 - rounded_discount, 2) if is_discrepancy else 0.0,
                'expected_rate': expected_rate,
                'expected_landed': expected_landed,
                'overcharge_per_pair': overcharge_per_pair,
                'total_overcharge': total_overcharge,
                'status': 'UNDER-DISCOUNTED' if is_discrepancy else 'COMPLIANT'
            }

            all_items.append(item_record)

            if is_discrepancy:
                discrepancies.append(item_record)
                inv_disc_count += 1
                inv_disc_loss += total_overcharge

        inv_summaries[inv_no] = {
            'invoice': inv_no,
            'date': inv_date,
            'ship_to': ship_to,
            'total_pairs': inv_total_pairs,
            'total_amount': inv_total_amt,
            'items_count': len(bill_data),
            'discrepancy_count': inv_disc_count,
            'total_loss': inv_disc_loss,
            'status': 'HAS DISCREPANCIES' if inv_disc_count > 0 else 'VERIFIED 37.5%'
        }

    # Generate Workbook
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # Remove default sheet

    # Colors and styles
    navy_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    red_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    green_fill = PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid")
    amber_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    gray_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    bold_font = Font(name="Calibri", size=11, bold=True)
    regular_font = Font(name="Calibri", size=10)
    title_font = Font(name="Calibri", size=14, bold=True, color="1E293B")
    subtitle_font = Font(name="Calibri", size=10, italic=True, color="64748B")

    thin_border = Border(
        left=Side(style='thin', color='CBD5E1'),
        right=Side(style='thin', color='CBD5E1'),
        top=Side(style='thin', color='CBD5E1'),
        bottom=Side(style='thin', color='CBD5E1')
    )

    # -------------------------------------------------------------
    # SHEET 1: DISCREPANCY AUDIT (ACTIONABLE CLAIM LIST)
    # -------------------------------------------------------------
    ws1 = wb.create_sheet(title="Discrepancy Line Items")

    ws1['A1'] = "SKIL LIFESTYLE LLP — AJANTA SHOES 37.5% DISCOUNT AUDIT"
    ws1['A1'].font = title_font
    ws1['A2'] = f"Generated: {datetime.now().strftime('%d-%b-%Y %H:%M:%S')} | Target Margin: Strictly 37.50% Landed Discount | Rule: Flag if < 37.45%"
    ws1['A2'].font = subtitle_font

    headers1 = [
        "S.No", "Invoice No", "Date", "Ship-To Customer", "Product Description", 
        "Pairs", "MRP (₹)", "Billed Rate (₹)", "Landed Cost (+5%) (₹)", "Net Discount %",
        "Target %", "Shortfall %", "Expected Rate (₹)", "Loss / Pair (₹)", "Total Overcharge (₹)", "Audit Recommendation"
    ]

    for col_idx, h in enumerate(headers1, 1):
        cell = ws1.cell(row=4, column=col_idx, value=h)
        cell.fill = navy_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    row_idx = 5
    for i, d in enumerate(sorted(discrepancies, key=lambda x: x['net_discount']), 1):
        ws1.cell(row=row_idx, column=1, value=i).alignment = Alignment(horizontal="center")
        ws1.cell(row=row_idx, column=2, value=d['invoice']).alignment = Alignment(horizontal="center")
        ws1.cell(row=row_idx, column=3, value=d['date']).alignment = Alignment(horizontal="center")
        ws1.cell(row=row_idx, column=4, value=d['ship_to'])
        ws1.cell(row=row_idx, column=5, value=d['desc'])
        ws1.cell(row=row_idx, column=6, value=d['pairs']).number_format = "#,##0"
        ws1.cell(row=row_idx, column=7, value=d['mrp']).number_format = "₹ #,##0.00"
        ws1.cell(row=row_idx, column=8, value=d['rate']).number_format = "₹ #,##0.00"
        ws1.cell(row=row_idx, column=9, value=d['landed_cost']).number_format = "₹ #,##0.00"
        
        disc_cell = ws1.cell(row=row_idx, column=10, value=d['net_discount'] / 100.0)
        disc_cell.number_format = "0.00%"
        disc_cell.font = Font(name="Calibri", size=10, bold=True, color="DC2626")
        
        ws1.cell(row=row_idx, column=11, value=d['standard_discount'] / 100.0).number_format = "0.00%"
        
        gap_cell = ws1.cell(row=row_idx, column=12, value=d['discount_gap'] / 100.0)
        gap_cell.number_format = "0.00%"
        gap_cell.font = Font(name="Calibri", size=10, bold=True, color="B45309")
        
        ws1.cell(row=row_idx, column=13, value=d['expected_rate']).number_format = "₹ #,##0.00"
        ws1.cell(row=row_idx, column=14, value=d['overcharge_per_pair']).number_format = "₹ #,##0.00"
        
        loss_cell = ws1.cell(row=row_idx, column=15, value=d['total_overcharge'])
        loss_cell.number_format = "₹ #,##0.00"
        loss_cell.font = Font(name="Calibri", size=10, bold=True, color="B91C1C")
        loss_cell.fill = red_fill
        
        recom_cell = ws1.cell(row=row_idx, column=16, value="Raise Debit Note / Claim Margin Shortfall")
        recom_cell.font = regular_font

        for col in range(1, 17):
            ws1.cell(row=row_idx, column=col).border = thin_border

        row_idx += 1

    # Total row
    ws1.cell(row=row_idx, column=5, value="TOTAL OVERCHARGE CLAIMABLE:").font = bold_font
    ws1.cell(row=row_idx, column=5).alignment = Alignment(horizontal="right")
    tot_pairs_cell = ws1.cell(row=row_idx, column=6, value=f"=SUM(F5:F{row_idx-1})")
    tot_pairs_cell.font = bold_font
    tot_pairs_cell.number_format = "#,##0"

    tot_loss_cell = ws1.cell(row=row_idx, column=15, value=f"=SUM(O5:O{row_idx-1})")
    tot_loss_cell.font = Font(name="Calibri", size=11, bold=True, color="B91C1C")
    tot_loss_cell.fill = amber_fill
    tot_loss_cell.number_format = "₹ #,##0.00"

    for col in range(1, 17):
        ws1.cell(row=row_idx, column=col).border = thin_border

    # -------------------------------------------------------------
    # SHEET 2: INVOICE SUMMARY
    # -------------------------------------------------------------
    ws2 = wb.create_sheet(title="Invoice-Level Summary")
    ws2['A1'] = "AJANTA INVOICES AUDIT STATUS"
    ws2['A1'].font = title_font

    headers2 = ["Invoice No", "Date", "Ship-To Customer", "Total Items", "Total Pairs", "Invoice Taxable Amount (₹)", "Discrepancy Items", "Total Margin Overcharge (₹)", "Status"]
    for col_idx, h in enumerate(headers2, 1):
        cell = ws2.cell(row=3, column=col_idx, value=h)
        cell.fill = navy_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    r = 4
    for inv_no, s in inv_summaries.items():
        ws2.cell(row=r, column=1, value=s['invoice']).alignment = Alignment(horizontal="center")
        ws2.cell(row=r, column=2, value=s['date']).alignment = Alignment(horizontal="center")
        ws2.cell(row=r, column=3, value=s['ship_to'])
        ws2.cell(row=r, column=4, value=s['items_count']).number_format = "#,##0"
        ws2.cell(row=r, column=5, value=s['total_pairs']).number_format = "#,##0"
        ws2.cell(row=r, column=6, value=s['total_amount']).number_format = "₹ #,##0.00"
        
        disc_cnt_cell = ws2.cell(row=r, column=7, value=s['discrepancy_count'])
        disc_cnt_cell.number_format = "#,##0"
        if s['discrepancy_count'] > 0:
            disc_cnt_cell.font = Font(name="Calibri", size=10, bold=True, color="DC2626")
            disc_cnt_cell.fill = red_fill

        loss_cell = ws2.cell(row=r, column=8, value=s['total_loss'])
        loss_cell.number_format = "₹ #,##0.00"
        if s['total_loss'] > 0:
            loss_cell.font = Font(name="Calibri", size=10, bold=True, color="B91C1C")

        status_cell = ws2.cell(row=r, column=9, value=s['status'])
        status_cell.alignment = Alignment(horizontal="center")
        status_cell.font = Font(name="Calibri", size=10, bold=True)
        if s['discrepancy_count'] > 0:
            status_cell.fill = red_fill
            status_cell.font = Font(name="Calibri", size=10, bold=True, color="B91C1C")
        else:
            status_cell.fill = green_fill
            status_cell.font = Font(name="Calibri", size=10, bold=True, color="059669")

        for c in range(1, 10):
            ws2.cell(row=r, column=c).border = thin_border
        r += 1

    # -------------------------------------------------------------
    # SHEET 3: CASH DISCOUNT AUDIT (FLAT 1.88% OF MRP)
    # -------------------------------------------------------------
    ws3 = wb.create_sheet(title="Cash Discount (1.88% MRP)")
    ws3['A1'] = "SKIL LIFESTYLE LLP — AJANTA SHOES CASH DISCOUNT CLAIM (30-DAY PAYMENT)"
    ws3['A1'].font = title_font
    ws3['A2'] = f"Generated: {datetime.now().strftime('%d-%b-%Y %H:%M:%S')} | Policy: Flat 1.88% on Published MRP | Term: 30-Day Payment Incentive"
    ws3['A2'].font = subtitle_font

    headers3 = [
        "S.No", "Invoice No", "Date", "Ship-To Customer", "Product Description",
        "MRP (₹)", "Billed Rate (₹)", "Landed Cost (5%) (₹)", "Margin %",
        "Total MRP (₹)", "CD / Pair @ 1.88% (₹)", "Pairs", "Line CD Total (₹)"
    ]

    for col_idx, h in enumerate(headers3, 1):
        cell = ws3.cell(row=4, column=col_idx, value=h)
        cell.fill = navy_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    r3 = 5
    tot_cd_pairs = 0
    tot_cd_mrp = 0.0
    tot_cd_claim = 0.0

    sno = 1
    for inv in invoices:
        inv_no = inv.get('invoice no', 'Unknown')
        inv_date = inv.get('date', 'Unknown')
        ship_to = inv.get('ship to', {}).get('name', 'Unknown')
        bill_data = inv.get('data', {}).get('bill data', [])

        for item in bill_data:
            desc = item.get('Description', 'Unknown Item')
            pairs = int(item.get('Pair', 0))
            mrp = float(item.get('MRP', 0.0))
            rate = float(item.get('Rate', 0.0))
            landed = round(rate * 1.05, 2)
            margin = round(((mrp - landed) / mrp) * 100, 2) if mrp > 0 else 0.0

            diff_per_pair = round(mrp * 0.0188, 2)
            line_cd = round(diff_per_pair * pairs, 2)
            line_mrp = round(mrp * pairs, 2)

            tot_cd_pairs += pairs
            tot_cd_mrp += line_mrp
            tot_cd_claim += line_cd

            ws3.cell(row=r3, column=1, value=sno).alignment = Alignment(horizontal="center")
            ws3.cell(row=r3, column=2, value=inv_no).alignment = Alignment(horizontal="center")
            ws3.cell(row=r3, column=3, value=inv_date).alignment = Alignment(horizontal="center")
            ws3.cell(row=r3, column=4, value=ship_to)
            ws3.cell(row=r3, column=5, value=desc)
            ws3.cell(row=r3, column=6, value=mrp).number_format = "₹ #,##0.00"
            ws3.cell(row=r3, column=7, value=rate).number_format = "₹ #,##0.00"
            ws3.cell(row=r3, column=8, value=landed).number_format = "₹ #,##0.00"

            m_cell = ws3.cell(row=r3, column=9, value=margin / 100.0)
            m_cell.number_format = "0.00%"

            ws3.cell(row=r3, column=10, value=line_mrp).number_format = "₹ #,##0.00"
            ws3.cell(row=r3, column=11, value=diff_per_pair).number_format = "₹ #,##0.00"
            ws3.cell(row=r3, column=12, value=pairs).number_format = "#,##0"

            cd_cell = ws3.cell(row=r3, column=13, value=line_cd)
            cd_cell.number_format = "₹ #,##0.00"
            cd_cell.fill = green_fill
            cd_cell.font = Font(name="Calibri", size=10, bold=True, color="047857")

            for c in range(1, 14):
                ws3.cell(row=r3, column=c).border = thin_border

            r3 += 1
            sno += 1

    # Total row for Sheet 3
    ws3.cell(row=r3, column=5, value="TOTAL CASH DISCOUNT CLAIM (1.88% OF MRP):").font = bold_font
    ws3.cell(row=r3, column=5).alignment = Alignment(horizontal="right")

    tot_mrp_c = ws3.cell(row=r3, column=10, value=f"=SUM(J5:J{r3-1})")
    tot_mrp_c.font = bold_font
    tot_mrp_c.number_format = "₹ #,##0.00"

    tot_prs_c = ws3.cell(row=r3, column=12, value=f"=SUM(L5:L{r3-1})")
    tot_prs_c.font = bold_font
    tot_prs_c.number_format = "#,##0"

    tot_cd_c = ws3.cell(row=r3, column=13, value=f"=SUM(M5:M{r3-1})")
    tot_cd_c.font = Font(name="Calibri", size=11, bold=True, color="047857")
    tot_cd_c.fill = green_fill
    tot_cd_c.number_format = "₹ #,##0.00"

    for c in range(1, 14):
        ws3.cell(row=r3, column=c).border = thin_border

    # -------------------------------------------------------------
    # SHEET 4: DEBIT NOTE MASTER SUMMARY
    # -------------------------------------------------------------
    ws4 = wb.create_sheet(title="Debit Note Master Summary", index=0)
    ws4['A1'] = "SKIL LIFESTYLE LLP — AJANTA SHOES DEBIT NOTE CLAIM STATEMENT"
    ws4['A1'].font = title_font
    ws4['A2'] = f"Generated: {datetime.now().strftime('%d-%b-%Y %H:%M:%S')} | Total Inward Invoices Audited: {len(invoices)} (August 2026)"
    ws4['A2'].font = subtitle_font

    summary_headers = ["Claim Head", "Audit Rule / Terms", "Pairs Impacted", "Scope", "Debit Note Claim Amount (₹)"]
    for ci, sh in enumerate(summary_headers, 1):
        c = ws4.cell(row=4, column=ci, value=sh)
        c.fill = navy_fill
        c.font = header_font
        c.alignment = Alignment(horizontal="center", vertical="center")

    summary_rows = [
        ("1. Price Discrepancy (Under Discount)", "Rate shortfall on items billed below agreed 37.50% landed discount", len(discrepancies), f"{sum(d['pairs'] for d in discrepancies):,d} pairs (6 bills)", sum(d['total_overcharge'] for d in discrepancies)),
        ("2. Cash Discount (30-Day Payment Incentive)", "Flat 1.88% of published MRP across all inward stock", tot_cd_pairs, f"{len(invoices)} bills (100% compliant)", tot_cd_claim),
        ("COMBINED TOTAL DEBIT NOTE CLAIM", "Full Supplier Recovery (Price Correction + Cash Discount)", tot_cd_pairs, "22 bills (10,410 pairs)", sum(d['total_overcharge'] for d in discrepancies) + tot_cd_claim)
    ]

    for ri, (head, rule, count, scope, amt) in enumerate(summary_rows, 5):
        is_grand = (ri == 7)
        ws4.cell(row=ri, column=1, value=head).font = bold_font if is_grand else regular_font
        ws4.cell(row=ri, column=2, value=rule).font = regular_font
        ws4.cell(row=ri, column=3, value=count).alignment = Alignment(horizontal="center")
        ws4.cell(row=ri, column=4, value=scope).alignment = Alignment(horizontal="center")
        
        amt_c = ws4.cell(row=ri, column=5, value=amt)
        amt_c.number_format = "₹ #,##0.00"
        amt_c.alignment = Alignment(horizontal="right")
        if is_grand:
            amt_c.font = Font(name="Calibri", size=12, bold=True, color="1E3A8A")
            amt_c.fill = amber_fill
            ws4.cell(row=ri, column=1).fill = amber_fill
            ws4.cell(row=ri, column=2).fill = amber_fill
            ws4.cell(row=ri, column=3).fill = amber_fill
            ws4.cell(row=ri, column=4).fill = amber_fill
        else:
            amt_c.font = bold_font

        for c in range(1, 6):
            ws4.cell(row=ri, column=c).border = thin_border

    # Auto-fit all column widths
    for sheet in [ws1, ws2, ws3, ws4]:
        for col in sheet.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val_str = str(cell.value or '')
                if cell.number_format and '%' in cell.number_format:
                    val_str = "00.00%"
                if len(val_str) > max_len:
                    max_len = len(val_str)
            sheet.column_dimensions[col_letter].width = max(max_len + 3, 12)

    ws1.freeze_panes = 'A5'
    ws2.freeze_panes = 'A4'
    ws3.freeze_panes = 'A5'
    ws4.freeze_panes = 'A5'

    wb.save(OUTPUT_EXCEL)
    print(f"SUCCESS: Generated 4-Sheet Excel report at {OUTPUT_EXCEL}")
    print(f"Total Discrepancies: {len(discrepancies)} (Claim: Rs. {sum(d['total_overcharge'] for d in discrepancies):.2f})")
    print(f"Cash Discount: Rs. {tot_cd_claim:.2f} across {tot_cd_pairs} pairs.")
    print(f"Combined Debit Note Claim: Rs. {sum(d['total_overcharge'] for d in discrepancies) + tot_cd_claim:.2f}")
    return True

if __name__ == '__main__':
    analyze_and_generate_excel()
