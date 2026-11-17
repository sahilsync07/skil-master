const TallyClient = require('./tally-client');
const normalizer = require('./normalizer');
const db = require('./database');
const folderUpdater = require('./folder-updater');

async function syncAllAndVerify() {
  const tc = new TallyClient();
  const xml = await tc.getVouchers('SKIL LIFESTYLE LLP', 0);
  const vouchers = normalizer.normalizeVouchers(xml);
  console.log(`Fetched ${vouchers.length} vouchers from Tally.`);

  // Upsert all into db
  db.upsertVouchers(vouchers);
  console.log(`Updated sync-engine/data/vouchers.json. Total vouchers in db: ${Object.keys(db.vouchers).length}`);

  // Also fetch stock items
  const stockXml = await tc.getStockItems('SKIL LIFESTYLE LLP', 0);
  const stockItems = normalizer.normalizeStockItems(stockXml);
  db.upsertStockItems(stockItems);
  console.log(`Updated sync-engine/data/stock_items.json. Total stock items in db: ${Object.keys(db.stockItems).length}`);

  // Update folder updater
  try {
    folderUpdater.updateAll();
    console.log('Updated managed directory timestamps.');
  } catch (e) {
    console.warn('Folder updater note:', e.message);
  }
}

syncAllAndVerify().catch(console.error);
