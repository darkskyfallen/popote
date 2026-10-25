// Données de référence : rayons, unités, profils d'équilibre, recettes d'exemple

export const AISLES = ['Fruits & légumes', 'Boulangerie', 'Boucherie & poisson', 'Crèmerie & frais', 'Épicerie', 'Surgelés', 'Autres']
export const AISLE_HUE = { 'Fruits & légumes': 130, 'Boulangerie': 35, 'Boucherie & poisson': 355, 'Crèmerie & frais': 205, 'Épicerie': 45, 'Surgelés': 190, 'Autres': 260 }
export const UNITS = ['g', 'kg', 'ml', 'cl', 'l', 'pièce', 'gousse', 'botte', 'boîte', 'pincée', 'c. à s.', 'c. à c.']
export const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export const SLOTS = [['midi', 'Midi'], ['soir', 'Soir']]
export const HUES = [12, 38, 65, 95, 150, 195, 260, 330]

// Profils d'équilibre : part des calories apportée par chaque macronutriment (%)
export const PROFILES = {
  equi: { name: 'Équilibré', desc: "Repères ANSES pour l'adulte", p: 15, g: 50, l: 35 },
  prot: { name: 'Riche en protéines', desc: 'Préserve les muscles pendant la perte de poids', p: 30, g: 40, l: 30 },
  medit: { name: 'Méditerranéen', desc: 'Bonnes graisses, légumes, légumineuses', p: 18, g: 45, l: 37 },
  lowcarb: { name: 'Pauvre en glucides', desc: 'Moins de féculents et de sucres', p: 30, g: 25, l: 45 }
}
export const FIBRE_MEAL = 10
export const CATS = { p: 'Protéines', g: 'Glucides', l: 'Lipides', f: 'Fibres', a: 'Aromate' }

// Apport principal des ingrédients connus : p protéines, g glucides, l lipides, f fibres/légumes, a aromate
export const ICAT_RAW = {
  'Spaghetti': 'g', 'Bœuf haché': 'p,l', 'Oignon': 'f', 'Ail': 'a', 'Tomates concassées': 'f', "Huile d'olive": 'l', 'Parmesan': 'p,l',
  'Courgette': 'f', 'Aubergine': 'f', 'Poivron': 'f', 'Tomate': 'f', 'Herbes de Provence': 'a', 'Pâte brisée': 'g,l', 'Lardons': 'p,l',
  'Œufs': 'p,l', 'Crème fraîche': 'l', 'Lait': 'p,g', 'Gruyère râpé': 'p,l', 'Pois chiches cuits': 'g,p,f', 'Lait de coco': 'l',
  'Curry en poudre': 'a', 'Épinards': 'f', 'Riz basmati': 'g', 'Pavé de saumon': 'p,l', 'Pommes de terre': 'g', 'Citron': 'a', 'Aneth': 'a',
  'Farine': 'g', 'Beurre': 'l', 'Sucre': 'g', 'Blanc de poulet': 'p', 'Haricots verts': 'f', 'Riz complet': 'g,f', 'Lentilles vertes': 'g,p,f',
  'Carotte': 'f', 'Échalote': 'f', 'Feta': 'p,l', 'Moutarde': 'a'
}
// Détection par mots-clés (texte sans accents, en minuscules), testée dans l'ordre
export const CRULES = [
  [/fromage blanc|skyr|yaourt|yogourt|lait(?! de coco)/, 'p,g'],
  [/fromage|gruyere|emmental|comte|parmesan|mozzarella|feta|chevre|raclette|cheddar/, 'p,l'],
  [/poulet|dinde|boeuf|veau|porc|agneau|jambon|steak|viande|poisson|saumon|thon|cabillaud|colin|crevette|oeuf|tofu|tempeh|seitan|merguez|saucisse/, 'p'],
  [/huile|beurre|creme|lardon|avocat|noix|amande|noisette|cacahuete|olive|margarine|mayonnaise|coco|graine/, 'l'],
  [/lentille|pois chiche|haricot rouge|haricot blanc|feve/, 'g,p,f'],
  [/riz|pate|spaghetti|tagliatelle|nouille|farine|pain|semoule|quinoa|boulgour|pomme de terre|patate|sucre|miel|mais|flocon|avoine|banane|biscuit|chapelure|gnocchi|tortilla/, 'g'],
  [/courgette|carotte|tomate|poivron|salade|laitue|epinard|brocoli|chou|haricot vert|poireau|champignon|aubergine|concombre|oignon|echalote|navet|potiron|courge|celeri|radis|asperge|petits pois|fenouil|betterave|pomme|poire|fruit|orange|fraise|framboise/, 'f'],
  [/sel|poivre|epice|curry|cumin|paprika|herbe|ail|persil|basilic|aneth|ciboulette|thym|laurier|romarin|coriandre|moutarde|vinaigre|citron|bouillon|sauce soja|muscade|cannelle|gingembre|levure/, 'a']
]

const FL = 'Fruits & légumes', BP = 'Boucherie & poisson', CF = 'Crèmerie & frais', EP = 'Épicerie'
const I = (name, qty, unit, aisle) => ({ name, qty, unit, aisle })

// Recettes d'exemple avec valeurs nutritionnelles estimées par portion
export const SEED_RECIPES = [
  { name: 'Spaghetti bolognaise', servings: 4, time: 45, hue: 12,
    ingredients: [I('Spaghetti', 400, 'g', EP), I('Bœuf haché', 500, 'g', BP), I('Oignon', 1, 'pièce', FL), I('Ail', 2, 'gousse', FL), I('Tomates concassées', 800, 'g', EP), I("Huile d'olive", 2, 'c. à s.', EP), I('Parmesan', 60, 'g', CF)],
    steps: ["Émincer l'oignon et l'ail, les faire revenir dans l'huile d'olive.", "Ajouter le bœuf haché et le faire dorer en l'émiettant.", 'Verser les tomates concassées, saler, poivrer et laisser mijoter 30 min à feu doux.', 'Cuire les spaghetti al dente, servir avec la sauce et le parmesan râpé.'],
    nutri: { kcal: 820, p: 44, g: 88, l: 30, f: 6 }, tip: 'Bœuf haché 5 % et moitié des pâtes remplacée par des tagliatelles de courgette : environ 520 kcal.' },
  { name: 'Ratatouille', servings: 4, time: 60, hue: 95,
    ingredients: [I('Courgette', 2, 'pièce', FL), I('Aubergine', 1, 'pièce', FL), I('Poivron', 2, 'pièce', FL), I('Tomate', 4, 'pièce', FL), I('Oignon', 1, 'pièce', FL), I('Ail', 3, 'gousse', FL), I("Huile d'olive", 4, 'c. à s.', EP), I('Herbes de Provence', 1, 'c. à c.', EP)],
    steps: ['Couper tous les légumes en dés.', "Faire revenir l'oignon et l'ail dans l'huile, puis ajouter poivrons et aubergine.", 'Ajouter courgettes, tomates et herbes, couvrir et mijoter 40 min.'],
    nutri: { kcal: 180, p: 4, g: 18, l: 10, f: 6 }, tip: "Très légère mais pauvre en protéines : ajoute un œuf poché, du poulet ou des pois chiches pour tenir jusqu'au repas suivant." },
  { name: 'Quiche lorraine', servings: 6, time: 50, hue: 38,
    ingredients: [I('Pâte brisée', 1, 'pièce', CF), I('Lardons', 200, 'g', BP), I('Œufs', 3, 'pièce', CF), I('Crème fraîche', 20, 'cl', CF), I('Lait', 20, 'cl', CF), I('Gruyère râpé', 100, 'g', CF)],
    steps: ['Préchauffer le four à 200 °C et foncer un moule avec la pâte.', 'Faire dorer les lardons à sec.', 'Battre œufs, crème et lait, saler peu et poivrer.', "Répartir lardons et gruyère, verser l'appareil et cuire 30 min."],
    nutri: { kcal: 495, p: 18, g: 25, l: 36, f: 1 }, tip: "Version sans pâte, lait demi-écrémé et crème à 15 % : environ 300 kcal. Accompagne d'une grande salade." },
  { name: 'Curry de pois chiches', servings: 4, time: 30, hue: 195,
    ingredients: [I('Pois chiches cuits', 500, 'g', EP), I('Lait de coco', 40, 'cl', EP), I('Oignon', 1, 'pièce', FL), I('Ail', 2, 'gousse', FL), I('Curry en poudre', 2, 'c. à s.', EP), I('Épinards', 200, 'g', FL), I('Riz basmati', 300, 'g', EP)],
    steps: ['Lancer la cuisson du riz.', 'Faire revenir oignon et ail, ajouter le curry 1 min.', 'Ajouter pois chiches et lait de coco, mijoter 15 min.', 'Incorporer les épinards en fin de cuisson.'],
    nutri: { kcal: 610, p: 18, g: 78, l: 24, f: 12 }, tip: 'Lait de coco allégé et 50 g de riz cru par personne : environ 450 kcal.' },
  { name: 'Saumon au four & pommes de terre', servings: 2, time: 40, hue: 330,
    ingredients: [I('Pavé de saumon', 2, 'pièce', BP), I('Pommes de terre', 600, 'g', FL), I('Citron', 1, 'pièce', FL), I('Aneth', 1, 'botte', FL), I('Crème fraîche', 10, 'cl', CF)],
    steps: ['Couper les pommes de terre en quartiers et les rôtir 20 min à 210 °C.', 'Ajouter les pavés de saumon avec rondelles de citron, cuire 12 min.', "Servir avec la crème mélangée à l'aneth ciselé."],
    nutri: { kcal: 650, p: 32, g: 48, l: 36, f: 5 }, tip: "Remplace la crème par du fromage blanc à l'aneth : environ 530 kcal." },
  { name: 'Crêpes', servings: 4, time: 25, hue: 260,
    ingredients: [I('Farine', 250, 'g', EP), I('Œufs', 4, 'pièce', CF), I('Lait', 0.5, 'l', CF), I('Beurre', 50, 'g', CF), I('Sucre', 1, 'c. à s.', EP)],
    steps: ['Mélanger farine et sucre, creuser un puits et ajouter les œufs.', 'Verser le lait petit à petit en fouettant, puis le beurre fondu.', 'Laisser reposer 1 h, cuire à la poêle bien chaude.'],
    nutri: { kcal: 445, p: 15, g: 60, l: 16, f: 2 }, tip: "Plutôt un dessert ou un goûter. Lait demi-écrémé et garniture aux fruits frais plutôt qu'à la pâte à tartiner." },
  { name: 'Poulet citron & haricots verts', servings: 2, time: 30, hue: 150,
    ingredients: [I('Blanc de poulet', 300, 'g', BP), I('Haricots verts', 400, 'g', FL), I('Riz complet', 100, 'g', EP), I('Citron', 1, 'pièce', FL), I('Ail', 1, 'gousse', FL), I("Huile d'olive", 1, 'c. à s.', EP)],
    steps: ['Cuire le riz complet.', 'Cuire les haricots verts 8 min à la vapeur.', "Saisir le poulet en lamelles dans l'huile avec l'ail, déglacer au jus de citron.", 'Servir moitié haricots, un quart poulet, un quart riz.'],
    nutri: { kcal: 460, p: 42, g: 42, l: 13, f: 8 }, tip: 'Déjà bien équilibré : moitié légumes, un quart protéines, un quart féculents complets.' },
  { name: 'Salade de lentilles & feta', servings: 4, time: 30, hue: 65,
    ingredients: [I('Lentilles vertes', 250, 'g', EP), I('Carotte', 2, 'pièce', FL), I('Échalote', 1, 'pièce', FL), I('Feta', 100, 'g', CF), I("Huile d'olive", 3, 'c. à s.', EP), I('Moutarde', 1, 'c. à c.', EP)],
    steps: ["Cuire les lentilles 20 min dans l'eau non salée, égoutter.", "Râper les carottes, ciseler l'échalote.", 'Mélanger huile et moutarde, assaisonner les lentilles tièdes.', 'Ajouter carottes, échalote et feta émiettée.'],
    nutri: { kcal: 390, p: 19, g: 40, l: 16, f: 12 }, tip: 'Riche en fibres et en protéines végétales, elle cale longtemps. Se garde 2 jours au frais pour les déjeuners.' }
]

export const defDiet = () => ({ on: false, target: 1800, profile: 'equi', prof: { sexe: 'F', age: 35, taille: 165, poids: 70, act: '1.375' } })
