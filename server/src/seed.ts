import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './lib/db';
import User from './models/User.model';
import MenuItem from './models/MenuItem.model';

/**
 * Sets up a fresh database:
 *   1. creates the owner's admin account from SEED_ADMIN_EMAIL /
 *      SEED_ADMIN_PASSWORD (left alone if it already exists), and
 *   2. adds a sample menu — but ONLY when there are no menu items yet.
 *
 * Nothing is ever deleted unless you pass --reset-menu, which removes every
 * menu item first. Never use that flag against the live shop.
 *
 *   npm run seed
 *   npm run seed -- --reset-menu
 */

const RESET_MENU = process.argv.includes('--reset-menu');

// ---- helpers for building option groups ----------------------------------

type Choice = [name: string, price: number];

const group = (name: string, required: boolean, multiple: boolean, choices: Choice[]) => ({
  name,
  required,
  multiple,
  options: choices.map(([optionName, price]) => ({ name: optionName, price })),
});

/** The size sets the price, so items using it have a base price of 0. */
const sizes = (choices: Choice[]) => group('Size', true, false, choices);
const flavour = (choices: Choice[]) => group('Flavour', true, false, choices);
const extras = (choices: Choice[]) => group('Extras', false, true, choices);

const CAKE_FLAVOURS: Choice[] = [
  ['Vanilla bean', 0],
  ['Chocolate', 0],
  ['Red velvet', 0],
  ['Lemon', 0],
  ['Coconut', 20],
];

const CAKE_EXTRAS: Choice[] = [
  ['Fresh fruit on top', 60],
  ['Gold drip', 50],
  ['Number candles', 20],
  ['Sparkler candles', 25],
];

// ---- sample menu (prices in Ghana cedis) ---------------------------------

const menuItems = [
  // Cakes
  {
    section: 'cakes',
    category: 'Celebration Cakes',
    name: 'Classic Celebration Cake',
    description: 'Soft sponge layered with silky buttercream and finished in your colours. Our birthday favourite.',
    price: 0,
    popular: true,
    allowMessage: true,
    optionGroups: [
      sizes([['6 inch (serves 8–10)', 450], ['8 inch (serves 15–20)', 650], ['10 inch (serves 25–30)', 900], ['12 inch (serves 40)', 1200]]),
      flavour(CAKE_FLAVOURS),
      extras(CAKE_EXTRAS),
    ],
  },
  {
    section: 'cakes',
    category: 'Celebration Cakes',
    name: 'Chocolate Fudge Cake',
    description: 'Deep, dark chocolate sponge with fudge frosting and a ganache drip. For serious chocolate lovers.',
    price: 0,
    allowMessage: true,
    optionGroups: [
      sizes([['6 inch', 500], ['8 inch', 720], ['10 inch', 980]]),
      extras([['Chocolate shards', 40], ['Fresh strawberries', 60], ['Number candles', 20]]),
    ],
  },
  {
    section: 'cakes',
    category: 'Theme & Wedding Cakes',
    name: 'Fondant Theme Cake',
    description: 'Smooth fondant finish, decorated to any theme. Tell us the theme in the order notes and we’ll confirm the design on WhatsApp.',
    price: 0,
    allowMessage: true,
    optionGroups: [
      sizes([['8 inch, one tier', 1100], ['10 inch, one tier', 1500], ['Two tiers (6 + 8 inch)', 2400], ['Three tiers', 3800]]),
      flavour(CAKE_FLAVOURS),
      extras([['Edible photo print', 80], ['Sugar flowers', 150], ['Gold leaf details', 120]]),
    ],
  },
  {
    section: 'cakes',
    category: 'Mini Cakes',
    name: 'Bento Cake',
    description: 'A little 4-inch cake in a takeaway box — just right for two. Comes with a wooden fork.',
    price: 220,
    popular: true,
    allowMessage: true,
    optionGroups: [
      flavour(CAKE_FLAVOURS),
      extras([['Add 4 matching cupcakes', 90], ['Candle', 10]]),
    ],
  },

  // Pastries & Treats
  {
    section: 'pastries',
    category: 'Cupcakes',
    name: 'Cupcakes',
    description: 'Fluffy cupcakes with a generous swirl of buttercream.',
    price: 0,
    popular: true,
    optionGroups: [
      group('Box', true, false, [['Box of 6', 180], ['Box of 12', 340]]),
      flavour([['Vanilla', 0], ['Chocolate', 0], ['Red velvet', 0], ['Mixed', 0]]),
      extras([['Sprinkles', 10], ['Gift ribbon', 15]]),
    ],
  },
  {
    section: 'pastries',
    category: 'Doughnuts',
    name: 'Glazed Doughnuts',
    description: 'Light, yeast-raised doughnuts, glazed the same morning.',
    price: 0,
    optionGroups: [
      group('Box', true, false, [['Box of 6', 120], ['Box of 12', 220]]),
      group('Glaze', true, false, [['Classic sugar', 0], ['Chocolate', 0], ['Strawberry', 0], ['Mixed', 0]]),
    ],
  },
  {
    section: 'pastries',
    category: 'Cookies & Bakes',
    name: 'Chocolate Chip Cookies',
    description: 'Crisp edges, chewy middles, plenty of chocolate.',
    price: 0,
    optionGroups: [group('Pack', true, false, [['Pack of 6', 75], ['Pack of 12', 140]])],
  },
  {
    section: 'pastries',
    category: 'Party Trays',
    name: 'Meat Pies',
    description: 'Golden, flaky pies with a well-seasoned filling. Priced per piece — perfect for parties and office trays.',
    price: 18,
    minQuantity: 10,
    optionGroups: [group('Filling', true, false, [['Minced beef', 0], ['Chicken', 2]])],
  },
  {
    section: 'pastries',
    category: 'Party Trays',
    name: 'Sausage Rolls',
    description: 'Buttery puff pastry wrapped around a juicy sausage filling. Priced per piece.',
    price: 15,
    minQuantity: 10,
    optionGroups: [],
  },

  // Gift Boxes
  {
    section: 'gifts',
    category: 'Gift Boxes',
    name: 'Sweet Treat Box',
    description: 'A ribboned box filled with your pick of treats, with a handwritten card. The box price covers packaging and the card.',
    price: 60,
    popular: true,
    isGift: true,
    allowMessage: true,
    optionGroups: [
      group('Choose your treats', true, true, [
        ['4 cupcakes', 120],
        ['6 cookies', 75],
        ['4 doughnuts', 85],
        ['4 brownies', 90],
        ['Mini banana bread loaf', 60],
      ]),
      extras([['Helium balloon', 40], ['Small teddy bear', 90], ['Box of chocolates', 85]]),
    ],
  },
  {
    section: 'gifts',
    category: 'Gift Boxes',
    name: 'Birthday Surprise Box',
    description: 'A bento cake with candles, plus extra treats of your choice, delivered with a card.',
    price: 280,
    isGift: true,
    allowMessage: true,
    optionGroups: [
      flavour(CAKE_FLAVOURS),
      group('Choose your treats', true, true, [
        ['4 cupcakes', 110],
        ['6 cookies', 70],
        ['4 doughnuts', 80],
        ['Party poppers', 25],
      ]),
      extras([['Helium balloon', 40], ['Small bouquet of flowers', 150]]),
    ],
  },
  {
    section: 'gifts',
    category: 'Gift Boxes',
    name: 'Breakfast in Bed Box',
    description: 'A morning surprise: fresh pastries in a tray box with a card. Delivered early in the day.',
    price: 90,
    isGift: true,
    allowMessage: true,
    optionGroups: [
      group('Choose your treats', true, true, [
        ['2 croissants', 60],
        ['2 cinnamon rolls', 70],
        ['Banana bread slices', 45],
        ['2 meat pies', 36],
        ['Fresh fruit cup', 40],
      ]),
      extras([['Bottled juice', 25], ['Coffee sachets', 20]]),
    ],
  },
];

// ---- run ------------------------------------------------------------------

async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!process.env.MONGODB_URI) {
    console.error('[seed] MONGODB_URI is not set. Add it to server/.env first.');
    process.exit(1);
  }
  if (!email || !password) {
    console.error('[seed] Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (in server/.env or the environment) and run again.');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('[seed] SEED_ADMIN_PASSWORD must be at least 6 characters.');
    process.exit(1);
  }

  await connectDB();

  if (await User.exists({ email })) {
    console.log(`[seed] Admin ${email} already exists — left unchanged.`);
  } else {
    await User.create({ name: 'Sugar City Admin', email, password, role: 'super_admin' });
    console.log(`[seed] Created admin ${email}`);
  }

  if (RESET_MENU) {
    const { deletedCount } = await MenuItem.deleteMany({});
    console.log(`[seed] --reset-menu: removed ${deletedCount} menu item(s).`);
  }

  const existing = await MenuItem.countDocuments();
  if (existing > 0) {
    console.log(`[seed] The menu already has ${existing} item(s) — sample menu not added. (Use --reset-menu to replace it.)`);
  } else {
    await MenuItem.insertMany(menuItems);
    console.log(`[seed] Added ${menuItems.length} sample menu items.`);
  }

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
