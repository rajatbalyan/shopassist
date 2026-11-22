/**
 * Builds the ShopAssist seed catalog.
 *
 * DEMO DATA: products, images and the original reviews come from DummyJSON
 * (https://dummyjson.com), a free fake-data API. Extra reviews are generated
 * below from templates so the "What buyers say" summary has material to work with.
 * None of this is real customer data.
 *
 * Usage: node scripts/build-seed.mjs
 * Output: src/data/products.json, src/data/categories.json
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://dummyjson.com/products?limit=0';
const USD_TO_INR = 85;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');

// slug -> [display name, how many to keep, review template group]
const CATEGORIES = {
  smartphones: ['Smartphones', 12, 'electronics'],
  laptops: ['Laptops', 5, 'electronics'],
  'mens-shirts': ["Men's Shirts", 5, 'apparel'],
  'womens-bags': ["Women's Bags", 5, 'bags'],
  'kitchen-accessories': ['Kitchen', 13, 'kitchen'],
  beauty: ['Beauty', 5, 'beauty'],
  'skin-care': ['Skin Care', 3, 'beauty'],
};

// Used when a preferred slug is missing from the source.
const FALLBACKS = {
  smartphones: ['mobile-accessories', 'tablets'],
  laptops: ['tablets'],
  'mens-shirts': ['tops'],
  'womens-bags': ['womens-shoes'],
  'kitchen-accessories': ['home-decoration'],
  beauty: ['fragrances'],
  'skin-care': ['fragrances'],
};

const SPONSORED_COUNT = 6;

// Phrases use keywords the mock insights engine looks for (battery, fit, fabric, ...).
const TEMPLATES = {
  electronics: {
    pros: [
      'Battery easily lasts a full day of heavy use.',
      'The display is bright and sharp, even outdoors.',
      'Camera takes crisp photos in daylight.',
      'Performance is smooth, no lag while multitasking.',
      'Build quality feels premium in the hand.',
      'Speakers are loud and the sound is clear.',
      'Delivery was quick and the packaging was secure.',
    ],
    cons: [
      'Battery drains fast when gaming.',
      'Gets warm and heats up during long video calls.',
      'Camera struggles in low light, photos look grainy.',
      'Charger is slow, takes ages to fully charge.',
      'Bit overpriced for what you get.',
      'Speaker sound is tinny at high volume.',
    ],
  },
  apparel: {
    pros: [
      'Fabric is soft and breathable, great for summer.',
      'Fit is true to size, sits well on the shoulders.',
      'Stitching is neat and feels durable.',
      'Colour stayed the same after several washes.',
      'Looks smart enough for office wear.',
      'Good value for money at this price.',
    ],
    cons: [
      'Runs a size small, order one size up for a proper fit.',
      'Colour faded a little after the first wash.',
      'Fabric wrinkles easily, needs ironing every time.',
      'Loose threads near the stitching on the collar.',
      'Shrank slightly after washing.',
    ],
  },
  bags: {
    pros: [
      'Plenty of space, fits a laptop and daily essentials.',
      'Material feels sturdy and well made.',
      'Strap is comfortable even when the bag is full.',
      'Zip and hardware feel durable.',
      'Looks elegant, matches most outfits.',
      'Good value for money at this price.',
    ],
    cons: [
      'Strap is thin and digs into the shoulder.',
      'Zip feels flimsy and got stuck a few times.',
      'Smaller than it looks in the photos.',
      'Material scratches easily.',
      'Had a strong chemical smell out of the box.',
    ],
  },
  kitchen: {
    pros: [
      'Sturdy build, feels like it will last years.',
      'Easy to clean, dishwasher safe.',
      'Handle has a comfortable grip.',
      'Does the job well and saves time while cooking.',
      'Good value for money at this price.',
      'Delivery was quick and the packaging was secure.',
    ],
    cons: [
      'Handle gets hot while cooking.',
      'Feels flimsy, the plastic parts bend.',
      'Coating started peeling after a month.',
      'Smaller than it looks in the photos.',
      'Hard to clean in the corners.',
    ],
  },
  beauty: {
    pros: [
      'Texture is light and absorbs quickly.',
      'Gentle on sensitive skin, no irritation.',
      'Lovely fragrance that is not overpowering.',
      'A little goes a long way, lasts for months.',
      'Skin feels hydrated and soft all day.',
      'Good value for money at this price.',
    ],
    cons: [
      'Caused a mild breakout on my skin.',
      'Fragrance is too strong for me.',
      'Texture feels greasy and sticky.',
      'Quantity is small for the price.',
      'Packaging leaked during delivery.',
    ],
  },
};

const OPENERS = {
  positive: ['Really happy with this.', 'Loving it so far.', 'Exceeded my expectations.', 'Solid purchase.', ''],
  mixed: ['Decent overall.', 'Mixed feelings.', 'Okay for the price.', ''],
  negative: ['Disappointed.', 'Not great.', 'Expected better.', ''],
};

const NAMES = [
  'Aarav Sharma', 'Priya Nair', 'Rohan Gupta', 'Ananya Iyer', 'Vikram Singh', 'Sneha Reddy',
  'Arjun Mehta', 'Kavya Menon', 'Rahul Verma', 'Ishita Bose', 'Karan Malhotra', 'Neha Joshi',
  'Siddharth Rao', 'Pooja Desai', 'Aditya Kulkarni', 'Meera Pillai', 'Nikhil Chopra', 'Divya Kapoor',
];

// Deterministic PRNG so re-running the script produces the same catalog.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const pickN = (rand, arr, n) => [...arr].sort(() => rand() - 0.5).slice(0, n);

// Round to a price ending in 9 (…9 under ₹1,000, …99 above).
function endIn9(value, mode = 'round') {
  const step = value >= 1000 ? 100 : 10;
  const fn = mode === 'up' ? Math.ceil : Math.round;
  return Math.max(step - 1, fn((value + 1) / step) * step - 1);
}

function generateReviews(rand, group, productId) {
  const { pros, cons } = TEMPLATES[group];
  const count = 4 + Math.floor(rand() * 3); // 4–6
  const reviews = [];
  for (let i = 0; i < count; i++) {
    // First generated review is always critical so every product has a con.
    const roll = rand();
    const kind = i === 0 ? 'negative' : roll < 0.75 ? 'positive' : roll < 0.92 ? 'mixed' : 'negative';
    let rating;
    let parts;
    if (kind === 'positive') {
      rating = rand() < 0.6 ? 5 : 4;
      parts = pickN(rand, pros, 2);
    } else if (kind === 'mixed') {
      rating = rand() < 0.5 ? 4 : 3;
      parts = [pick(rand, pros), `But ${lowerFirst(pick(rand, cons))}`];
    } else {
      rating = rand() < 0.5 ? 3 : rand() < 0.7 ? 2 : 1;
      parts = rand() < 0.5 ? pickN(rand, cons, 2) : [pick(rand, cons)];
    }
    const opener = pick(rand, OPENERS[kind]);
    const daysAgo = 3 + Math.floor(rand() * 300);
    reviews.push({
      id: `${productId}-g${i + 1}`,
      rating,
      comment: [opener, ...parts].filter(Boolean).join(' '),
      reviewerName: pick(rand, NAMES),
      date: new Date(Date.UTC(2026, 10, 20) - daysAgo * 86400000).toISOString(),
      verified: true,
    });
  }
  return reviews;
}

function lowerFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function buildSpecs(p) {
  const specs = {};
  if (p.brand) specs.Brand = p.brand;
  if (p.sku) specs.SKU = p.sku;
  if (p.weight != null) specs['Shipping weight'] = `${p.weight} kg`;
  if (p.dimensions) {
    const { width, height, depth } = p.dimensions;
    specs.Dimensions = `${width} × ${height} × ${depth} cm`;
  }
  if (p.warrantyInformation) specs.Warranty = p.warrantyInformation;
  if (p.shippingInformation) specs.Shipping = p.shippingInformation;
  if (p.returnPolicy) specs['Return policy'] = p.returnPolicy;
  return specs;
}

function mapProduct(p, slug, group) {
  const id = String(p.id);
  const rand = mulberry32(p.id * 7919);
  const price = endIn9(p.price * USD_TO_INR);
  let mrp = endIn9(price / (1 - p.discountPercentage / 100), 'up');
  if (mrp <= price) mrp = endIn9(price + 1, 'up');

  const original = (p.reviews ?? []).map((r, i) => ({
    id: `${id}-r${i + 1}`,
    rating: r.rating,
    comment: r.comment,
    reviewerName: r.reviewerName,
    date: r.date,
    verified: true,
  }));
  const reviews = [...original, ...generateReviews(rand, group, id)].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const rating = Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;

  return {
    id,
    title: p.title,
    brand: p.brand ?? 'Generic',
    category: slug,
    description: p.description,
    price,
    mrp,
    rating,
    reviewCount: reviews.length,
    images: p.images,
    thumbnail: p.thumbnail,
    specs: buildSpecs(p),
    stock: p.stock,
    tags: p.tags ?? [],
    reviews,
  };
}

async function main() {
  console.log(`Fetching ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`DummyJSON returned ${res.status}`);
  const { products: source } = await res.json();

  const products = [];
  const categories = [];
  for (const [slug, [name, limit, group]] of Object.entries(CATEGORIES)) {
    const candidates = [slug, ...(FALLBACKS[slug] ?? [])];
    const sourceSlug = candidates.find((c) => source.some((p) => p.category === c));
    if (!sourceSlug) {
      console.warn(`No products for ${slug} or its fallbacks, skipping`);
      continue;
    }
    if (sourceSlug !== slug) console.warn(`Using ${sourceSlug} in place of ${slug}`);
    const picked = source.filter((p) => p.category === sourceSlug).slice(0, limit);
    const mapped = picked.map((p) => mapProduct(p, slug, group));
    products.push(...mapped);
    const discounts = mapped.map((p) => Math.round(((p.mrp - p.price) / p.mrp) * 100));
    categories.push({
      slug,
      name,
      count: mapped.length,
      avgDiscount: Math.round(discounts.reduce((s, d) => s + d, 0) / discounts.length),
      maxDiscount: Math.max(...discounts),
      image: mapped[0].thumbnail,
    });
  }

  // Sponsor the second product of the first N categories so they are spread out.
  for (const { slug } of categories.slice(0, SPONSORED_COUNT)) {
    const inCategory = products.filter((p) => p.category === slug);
    const target = inCategory[1] ?? inCategory[0];
    if (target) target.sponsored = true;
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'products.json'), JSON.stringify(products, null, 2) + '\n');
  await writeFile(join(OUT_DIR, 'categories.json'), JSON.stringify(categories, null, 2) + '\n');
  console.log(`Wrote ${products.length} products in ${categories.length} categories to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
