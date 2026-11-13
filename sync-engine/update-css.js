const fs = require('fs');
const path = require('path');

const cssToAdd = `
/* ==========================================================================
   7. INTERACTIVE AGING BUCKET CARDS & SETTLEMENT MODAL (SAHIL'S BIZ)
   ========================================================================== */
.aging-hero-banner {
  background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
  border-radius: 16px;
  padding: 22px 24px;
  color: #FFFFFF;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.12);
}

.bucket-kpi-card {
  background: #FFFFFF;
  border: 1.5px solid #E2E8F0;
  border-radius: 14px;
  padding: 16px 18px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.bucket-kpi-card:hover {
  transform: translateY(-2px);
  border-color: #94A3B8;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.08);
}

.bucket-kpi-card.bucket-active {
  border: 2px solid #0284C7 !important;
  background: #F0F9FF !important;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15) !important;
}

.bucket-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.bucket-label {
  font-size: 13px;
  font-weight: 700;
  color: #475569;
}

.bucket-pill {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.pill-emerald {
  background: #DCFCE7;
  color: #15803D;
}

.pill-amber {
  background: #FEF3C7;
  color: #B45309;
}

.pill-orange {
  background: #FFEDD5;
  color: #C2410C;
}

.pill-slate {
  background: #F1F5F9;
  color: #475569;
}

.bucket-value {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin-bottom: 4px;
}

.bucket-subtext {
  font-size: 11px;
  color: #64748B;
  font-weight: 500;
}

/* Settlement Modal Grid & Elements */
.settlement-dual-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.settlement-bills-checklist {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settle-bill-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12.5px;
  transition: background 0.15s ease;
  cursor: pointer;
  border-bottom: 1px solid #F1F5F9;
}

.settle-bill-row:hover {
  background: #F8FAFC;
}

.settle-bill-row.checked {
  background: #F0FDF4;
}

.btn-settle-action {
  transition: all 0.15s ease;
}

.btn-settle-action:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

.btn-settle-action:active {
  transform: translateY(0);
}

/* GST Compliance View Elements */
.deadline-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.deadline-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}

/* Responsive Devices Rules: Foldables, Phones, Tablets */
@media (max-width: 860px) {
  .settlement-dual-grid {
    grid-template-columns: 1fr !important;
  }
  .settlement-actions-grid {
    grid-template-columns: 1fr !important;
  }
  .whatsapp-preview-textarea {
    height: 200px !important;
  }
}

/* Galaxy Z Fold / Foldable Unfolded Display (700px - 950px) */
@media (min-width: 680px) and (max-width: 950px) {
  .app-sidebar {
    width: 210px;
  }
  .app-main {
    padding: 16px;
  }
  .aging-buckets-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

/* Print Stylesheet for Customer Statement PDF */
@media print {
  body * {
    visibility: hidden;
  }
  #printStatementContainer, #printStatementContainer * {
    visibility: visible;
  }
  #printStatementContainer {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 20px;
    background: #FFFFFF !important;
    color: #000000 !important;
  }
}
`;

const p1 = path.join(__dirname, '..', 'android-app', 'www', 'style.css');
const p2 = path.join(__dirname, 'public', 'style.css');

[p1, p2].forEach(p => {
  if (fs.existsSync(p)) {
    const orig = fs.readFileSync(p, 'utf8');
    if (!orig.includes('INTERACTIVE AGING BUCKET CARDS')) {
      fs.writeFileSync(p, orig + '\n' + cssToAdd, 'utf8');
      console.log('Appended styles to:', p);
    } else {
      console.log('Styles already present in:', p);
    }
  }
});
