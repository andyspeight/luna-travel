/**
 * Saying which allergy, not just that you have one.
 *
 * The phrase book carries "I'm allergic to…" in twelve languages. Every one of
 * them is correct, and together they do not do the job: the sentence ends in an
 * ellipsis, and the traveller finishes it in English. "Soy alérgico a…
 * peanuts" puts the one word carrying the whole meaning into a language the
 * listener may not have. A Spanish waiter needs *cacahuetes*; a Thai server is
 * not likely to know "shellfish".
 *
 * That is the single phrase in the book where being misunderstood is medical
 * rather than awkward, so it gets the completed sentence.
 *
 * WHOLE SENTENCES, NEVER COMPOSED. It is tempting to store one stem per
 * language and slot a noun into it. It breaks, in most of these languages:
 *
 *   - Turkish puts the allergen FIRST: "Yer fıstığı alerjim var"
 *   - Greek contracts preposition and article: στα / στο / στη, by gender
 *   - Spanish and Italian need the matching article: a los / a la / al
 *   - Polish needs the accusative: soja → soję, gorczyca → gorczycę
 *
 * A template would produce confident nonsense in exactly the situation where
 * nonsense is dangerous. So each line below is written out in full.
 *
 * "I HAVE AN ALLERGY TO", NOT "I AM ALLERGIC TO". Chosen deliberately: the
 * possessive construction avoids gender agreement in almost every language
 * here, so one line serves every traveller. "Soy alérgico/alérgica" needs two;
 * "Tengo alergia a" needs one. Thai is the exception, because the polite
 * pronoun itself is gendered — it is left off, which is normal in speech, and
 * the phrase book carries the fuller forms.
 *
 * THE LIST is the UK's fourteen regulated allergens, the ones a British
 * traveller will have been told to avoid and the ones their menus at home
 * declare. Not a guess at the common ones: if somebody has a celery allergy,
 * nobody else is going to write this down for them.
 *
 * Where a precise term would not be understood by the person serving the food,
 * the broader one is used and the note says so. For an allergy, too broad is
 * safe and too narrow is not.
 */

export interface AllergenPhrase {
  /** The allergen as a British traveller names it. */
  en: string;
  /** The complete sentence, ready to show or speak. */
  local: string;
  /** How to say the whole thing. */
  say: string;
  /** Anything that catches people out. */
  note?: string;
}

const SPANISH: AllergenPhrase[] = [
  { en: 'Peanuts', local: 'Tengo alergia a los cacahuetes', say: 'TEN-go ah-lehr-HEE-ah ah los kah-kah-WEH-tes' },
  { en: 'Tree nuts', local: 'Tengo alergia a los frutos secos', say: 'TEN-go ah-lehr-HEE-ah ah los FROO-tos SEH-kos' },
  { en: 'Milk and dairy', local: 'Tengo alergia a la leche', say: 'TEN-go ah-lehr-HEE-ah ah lah LEH-cheh' },
  { en: 'Eggs', local: 'Tengo alergia al huevo', say: 'TEN-go ah-lehr-HEE-ah al WEH-boh' },
  { en: 'Fish', local: 'Tengo alergia al pescado', say: 'TEN-go ah-lehr-HEE-ah al pes-KAH-doh' },
  { en: 'Shellfish', local: 'Tengo alergia a los mariscos', say: 'TEN-go ah-lehr-HEE-ah ah los mah-REES-kos', note: 'Mariscos covers all seafood, which is the safer side to be on.' },
  { en: 'Molluscs', local: 'Tengo alergia a los moluscos', say: 'TEN-go ah-lehr-HEE-ah ah los moh-LOOS-kos' },
  { en: 'Gluten and wheat', local: 'Tengo alergia al gluten', say: 'TEN-go ah-lehr-HEE-ah al GLOO-ten' },
  { en: 'Soya', local: 'Tengo alergia a la soja', say: 'TEN-go ah-lehr-HEE-ah ah lah SOH-hah' },
  { en: 'Sesame', local: 'Tengo alergia al sésamo', say: 'TEN-go ah-lehr-HEE-ah al SEH-sah-moh' },
  { en: 'Celery', local: 'Tengo alergia al apio', say: 'TEN-go ah-lehr-HEE-ah al AH-pyoh' },
  { en: 'Mustard', local: 'Tengo alergia a la mostaza', say: 'TEN-go ah-lehr-HEE-ah ah lah mos-TAH-thah' },
  { en: 'Lupin', local: 'Tengo alergia al altramuz', say: 'TEN-go ah-lehr-HEE-ah al al-trah-MOOTH' },
  { en: 'Sulphites', local: 'Tengo alergia a los sulfitos', say: 'TEN-go ah-lehr-HEE-ah ah los sool-FEE-tos' },
];

const FRENCH: AllergenPhrase[] = [
  { en: 'Peanuts', local: 'Je suis allergique aux arachides', say: 'zhuh swee ah-lehr-ZHEEK oh zah-rah-SHEED', note: 'Cacahuètes is understood too.' },
  { en: 'Tree nuts', local: 'Je suis allergique aux fruits à coque', say: 'zhuh swee ah-lehr-ZHEEK oh frwee ah KOK' },
  { en: 'Milk and dairy', local: 'Je suis allergique au lait', say: 'zhuh swee ah-lehr-ZHEEK oh LEH' },
  { en: 'Eggs', local: 'Je suis allergique aux œufs', say: 'zhuh swee ah-lehr-ZHEEK oh ZUH' },
  { en: 'Fish', local: 'Je suis allergique au poisson', say: 'zhuh swee ah-lehr-ZHEEK oh pwah-SON' },
  { en: 'Shellfish', local: 'Je suis allergique aux crustacés', say: 'zhuh swee ah-lehr-ZHEEK oh kroos-tah-SAY' },
  { en: 'Molluscs', local: 'Je suis allergique aux mollusques', say: 'zhuh swee ah-lehr-ZHEEK oh mo-LUSK' },
  { en: 'Gluten and wheat', local: 'Je suis allergique au gluten', say: 'zhuh swee ah-lehr-ZHEEK oh gloo-TEN' },
  { en: 'Soya', local: 'Je suis allergique au soja', say: 'zhuh swee ah-lehr-ZHEEK oh so-ZHAH' },
  { en: 'Sesame', local: 'Je suis allergique au sésame', say: 'zhuh swee ah-lehr-ZHEEK oh say-ZAM' },
  { en: 'Celery', local: 'Je suis allergique au céleri', say: 'zhuh swee ah-lehr-ZHEEK oh sayl-REE' },
  { en: 'Mustard', local: 'Je suis allergique à la moutarde', say: 'zhuh swee ah-lehr-ZHEEK ah lah moo-TARD' },
  { en: 'Lupin', local: 'Je suis allergique au lupin', say: 'zhuh swee ah-lehr-ZHEEK oh loo-PAN' },
  { en: 'Sulphites', local: 'Je suis allergique aux sulfites', say: 'zhuh swee ah-lehr-ZHEEK oh sool-FEET' },
];

const ITALIAN: AllergenPhrase[] = [
  { en: 'Peanuts', local: "Ho un'allergia alle arachidi", say: 'oh oo-nal-lehr-JEE-ah AL-leh ah-RAH-kee-dee' },
  { en: 'Tree nuts', local: "Ho un'allergia alla frutta secca", say: 'oh oo-nal-lehr-JEE-ah AL-lah FROOT-tah SEK-kah' },
  { en: 'Milk and dairy', local: "Ho un'allergia al latte", say: 'oh oo-nal-lehr-JEE-ah al LAT-teh' },
  { en: 'Eggs', local: "Ho un'allergia alle uova", say: 'oh oo-nal-lehr-JEE-ah AL-leh WOH-vah' },
  { en: 'Fish', local: "Ho un'allergia al pesce", say: 'oh oo-nal-lehr-JEE-ah al PEH-sheh' },
  { en: 'Shellfish', local: "Ho un'allergia ai crostacei", say: 'oh oo-nal-lehr-JEE-ah ahee kros-TAH-cheh-ee' },
  { en: 'Molluscs', local: "Ho un'allergia ai molluschi", say: 'oh oo-nal-lehr-JEE-ah ahee mol-LOOS-kee' },
  { en: 'Gluten and wheat', local: "Ho un'allergia al glutine", say: 'oh oo-nal-lehr-JEE-ah al GLOO-tee-neh' },
  { en: 'Soya', local: "Ho un'allergia alla soia", say: 'oh oo-nal-lehr-JEE-ah AL-lah SOH-yah' },
  { en: 'Sesame', local: "Ho un'allergia al sesamo", say: 'oh oo-nal-lehr-JEE-ah al SEH-zah-moh' },
  { en: 'Celery', local: "Ho un'allergia al sedano", say: 'oh oo-nal-lehr-JEE-ah al SEH-dah-noh' },
  { en: 'Mustard', local: "Ho un'allergia alla senape", say: 'oh oo-nal-lehr-JEE-ah AL-lah SEH-nah-peh' },
  { en: 'Lupin', local: "Ho un'allergia ai lupini", say: 'oh oo-nal-lehr-JEE-ah ahee loo-PEE-nee' },
  { en: 'Sulphites', local: "Ho un'allergia ai solfiti", say: 'oh oo-nal-lehr-JEE-ah ahee sol-FEE-tee' },
];

const PORTUGUESE: AllergenPhrase[] = [
  { en: 'Peanuts', local: 'Tenho alergia a amendoim', say: 'TEH-nyoo ah-lehr-ZHEE-ah ah ah-men-doo-EEN' },
  { en: 'Tree nuts', local: 'Tenho alergia a frutos secos', say: 'TEH-nyoo ah-lehr-ZHEE-ah ah FROO-toosh SEH-koosh' },
  { en: 'Milk and dairy', local: 'Tenho alergia a leite', say: 'TEH-nyoo ah-lehr-ZHEE-ah ah LAY-teh' },
  { en: 'Eggs', local: 'Tenho alergia a ovo', say: 'TEH-nyoo ah-lehr-ZHEE-ah ah OH-voo' },
  { en: 'Fish', local: 'Tenho alergia a peixe', say: 'TEH-nyoo ah-lehr-ZHEE-ah ah PAY-sheh' },
  { en: 'Shellfish', local: 'Tenho alergia a marisco', say: 'TEH-nyoo ah-lehr-ZHEE-ah ah mah-REESH-koo', note: 'Marisco covers seafood broadly, which is the safer side to be on.' },
  { en: 'Molluscs', local: 'Tenho alergia a moluscos', say: 'TEH-nyoo ah-lehr-ZHEE-ah ah moh-LOOSH-koosh' },
  { en: 'Gluten and wheat', local: 'Tenho alergia a glúten', say: 'TEH-nyoo ah-lehr-ZHEE-ah ah GLOO-ten' },
  { en: 'Soya', local: 'Tenho alergia a soja', say: 'TEH-nyoo ah-lehr-ZHEE-ah ah SOH-zhah' },
  { en: 'Sesame', local: 'Tenho alergia a sésamo', say: 'TEH-nyoo ah-lehr-ZHEE-ah ah SEH-zah-moo' },
  { en: 'Celery', local: 'Tenho alergia a aipo', say: 'TEH-nyoo ah-lehr-ZHEE-ah ah AI-poo' },
  { en: 'Mustard', local: 'Tenho alergia a mostarda', say: 'TEH-nyoo ah-lehr-ZHEE-ah ah moosh-TAR-dah' },
  { en: 'Lupin', local: 'Tenho alergia a tremoço', say: 'TEH-nyoo ah-lehr-ZHEE-ah ah treh-MOH-soo' },
  { en: 'Sulphites', local: 'Tenho alergia a sulfitos', say: 'TEH-nyoo ah-lehr-ZHEE-ah ah sool-FEE-toosh' },
];

const GERMAN: AllergenPhrase[] = [
  { en: 'Peanuts', local: 'Ich habe eine Allergie gegen Erdnüsse', say: 'ikh HAH-beh INE-eh ah-lehr-GEE GAY-gen EHRT-noos-seh' },
  { en: 'Tree nuts', local: 'Ich habe eine Allergie gegen Nüsse', say: 'ikh HAH-beh INE-eh ah-lehr-GEE GAY-gen NOOS-seh' },
  { en: 'Milk and dairy', local: 'Ich habe eine Allergie gegen Milch', say: 'ikh HAH-beh INE-eh ah-lehr-GEE GAY-gen MILKH' },
  { en: 'Eggs', local: 'Ich habe eine Allergie gegen Eier', say: 'ikh HAH-beh INE-eh ah-lehr-GEE GAY-gen EYE-er' },
  { en: 'Fish', local: 'Ich habe eine Allergie gegen Fisch', say: 'ikh HAH-beh INE-eh ah-lehr-GEE GAY-gen FISH' },
  { en: 'Shellfish', local: 'Ich habe eine Allergie gegen Krebstiere', say: 'ikh HAH-beh INE-eh ah-lehr-GEE GAY-gen KREPS-tee-reh' },
  { en: 'Molluscs', local: 'Ich habe eine Allergie gegen Weichtiere', say: 'ikh HAH-beh INE-eh ah-lehr-GEE GAY-gen VYKH-tee-reh' },
  { en: 'Gluten and wheat', local: 'Ich habe eine Allergie gegen Gluten', say: 'ikh HAH-beh INE-eh ah-lehr-GEE GAY-gen GLOO-ten' },
  { en: 'Soya', local: 'Ich habe eine Allergie gegen Soja', say: 'ikh HAH-beh INE-eh ah-lehr-GEE GAY-gen ZOH-yah' },
  { en: 'Sesame', local: 'Ich habe eine Allergie gegen Sesam', say: 'ikh HAH-beh INE-eh ah-lehr-GEE GAY-gen ZEH-zahm' },
  { en: 'Celery', local: 'Ich habe eine Allergie gegen Sellerie', say: 'ikh HAH-beh INE-eh ah-lehr-GEE GAY-gen ZEL-eh-ree' },
  { en: 'Mustard', local: 'Ich habe eine Allergie gegen Senf', say: 'ikh HAH-beh INE-eh ah-lehr-GEE GAY-gen ZENF' },
  { en: 'Lupin', local: 'Ich habe eine Allergie gegen Lupinen', say: 'ikh HAH-beh INE-eh ah-lehr-GEE GAY-gen loo-PEE-nen' },
  { en: 'Sulphites', local: 'Ich habe eine Allergie gegen Sulfite', say: 'ikh HAH-beh INE-eh ah-lehr-GEE GAY-gen zool-FEE-teh' },
];

const GREEK: AllergenPhrase[] = [
  { en: 'Peanuts', local: 'Έχω αλλεργία στα φιστίκια', say: 'EH-kho ah-lehr-YEE-ah stah fee-STEE-kyah' },
  { en: 'Tree nuts', local: 'Έχω αλλεργία στους ξηρούς καρπούς', say: 'EH-kho ah-lehr-YEE-ah stoos ksee-ROOS kar-POOS' },
  { en: 'Milk and dairy', local: 'Έχω αλλεργία στο γάλα', say: 'EH-kho ah-lehr-YEE-ah sto GHAH-lah' },
  { en: 'Eggs', local: 'Έχω αλλεργία στα αυγά', say: 'EH-kho ah-lehr-YEE-ah stah av-GHAH' },
  { en: 'Fish', local: 'Έχω αλλεργία στο ψάρι', say: 'EH-kho ah-lehr-YEE-ah sto PSAH-ree' },
  { en: 'Shellfish', local: 'Έχω αλλεργία στα θαλασσινά', say: 'EH-kho ah-lehr-YEE-ah stah thah-lah-see-NAH', note: 'Θαλασσινά means all seafood. Deliberately broad — safer than a word a cook may not know.' },
  {
    en: 'Molluscs',
    local: 'Έχω αλλεργία στα μαλάκια',
    say: 'EH-kho ah-lehr-YEE-ah stah mah-LAH-kyah',
    note: 'Say this one carefully, or show the screen: μαλάκια sits one slip away from a well-known Greek insult. Έχω αλλεργία στα θαλασσινά — stah thah-lah-see-NAH — is safer out loud.',
  },
  { en: 'Gluten and wheat', local: 'Έχω αλλεργία στη γλουτένη', say: 'EH-kho ah-lehr-YEE-ah stee ghloo-TEH-nee' },
  { en: 'Soya', local: 'Έχω αλλεργία στη σόγια', say: 'EH-kho ah-lehr-YEE-ah stee SOH-yah' },
  { en: 'Sesame', local: 'Έχω αλλεργία στο σουσάμι', say: 'EH-kho ah-lehr-YEE-ah sto soo-SAH-mee' },
  { en: 'Celery', local: 'Έχω αλλεργία στο σέλινο', say: 'EH-kho ah-lehr-YEE-ah sto SEH-lee-no' },
  { en: 'Mustard', local: 'Έχω αλλεργία στη μουστάρδα', say: 'EH-kho ah-lehr-YEE-ah stee moo-STAR-dhah' },
  { en: 'Lupin', local: 'Έχω αλλεργία στο λούπινο', say: 'EH-kho ah-lehr-YEE-ah sto LOO-pee-no' },
  { en: 'Sulphites', local: 'Έχω αλλεργία στα θειώδη', say: 'EH-kho ah-lehr-YEE-ah stah thee-OH-dhee' },
];

// Turkish puts the allergen first and attaches the possessive to "alerji".
// This is the clearest case for whole sentences over a template.
const TURKISH: AllergenPhrase[] = [
  { en: 'Peanuts', local: 'Yer fıstığı alerjim var', say: 'yehr fuh-stuh-UH ah-ler-ZHEEM var' },
  { en: 'Tree nuts', local: 'Kuruyemiş alerjim var', say: 'koo-roo-yeh-MEESH ah-ler-ZHEEM var' },
  { en: 'Milk and dairy', local: 'Süt alerjim var', say: 'SOOT ah-ler-ZHEEM var' },
  { en: 'Eggs', local: 'Yumurta alerjim var', say: 'yoo-moor-TAH ah-ler-ZHEEM var' },
  { en: 'Fish', local: 'Balık alerjim var', say: 'bah-LUHK ah-ler-ZHEEM var' },
  { en: 'Shellfish', local: 'Kabuklu deniz ürünleri alerjim var', say: 'kah-book-LOO deh-NEEZ oo-roon-leh-REE ah-ler-ZHEEM var' },
  { en: 'Molluscs', local: 'Yumuşakça alerjim var', say: 'yoo-moo-shahk-CHAH ah-ler-ZHEEM var' },
  { en: 'Gluten and wheat', local: 'Gluten alerjim var', say: 'gloo-TEN ah-ler-ZHEEM var' },
  { en: 'Soya', local: 'Soya alerjim var', say: 'soh-YAH ah-ler-ZHEEM var' },
  { en: 'Sesame', local: 'Susam alerjim var', say: 'soo-SAHM ah-ler-ZHEEM var' },
  { en: 'Celery', local: 'Kereviz alerjim var', say: 'keh-reh-VEEZ ah-ler-ZHEEM var' },
  { en: 'Mustard', local: 'Hardal alerjim var', say: 'har-DAHL ah-ler-ZHEEM var' },
  { en: 'Lupin', local: 'Acı bakla alerjim var', say: 'ah-JUH bahk-LAH ah-ler-ZHEEM var' },
  { en: 'Sulphites', local: 'Sülfit alerjim var', say: 'sool-FEET ah-ler-ZHEEM var' },
];

const DUTCH: AllergenPhrase[] = [
  { en: 'Peanuts', local: "Ik heb een allergie voor pinda's", say: 'ik hep un ah-lehr-GHEE for PIN-dahs' },
  { en: 'Tree nuts', local: 'Ik heb een allergie voor noten', say: 'ik hep un ah-lehr-GHEE for NOH-ten' },
  { en: 'Milk and dairy', local: 'Ik heb een allergie voor melk', say: 'ik hep un ah-lehr-GHEE for MELK' },
  { en: 'Eggs', local: 'Ik heb een allergie voor ei', say: 'ik hep un ah-lehr-GHEE for AY' },
  { en: 'Fish', local: 'Ik heb een allergie voor vis', say: 'ik hep un ah-lehr-GHEE for VIS' },
  { en: 'Shellfish', local: 'Ik heb een allergie voor schaaldieren', say: 'ik hep un ah-lehr-GHEE for SKHAHL-dee-ren' },
  { en: 'Molluscs', local: 'Ik heb een allergie voor weekdieren', say: 'ik hep un ah-lehr-GHEE for VAYK-dee-ren' },
  { en: 'Gluten and wheat', local: 'Ik heb een allergie voor gluten', say: 'ik hep un ah-lehr-GHEE for GHLOO-ten' },
  { en: 'Soya', local: 'Ik heb een allergie voor soja', say: 'ik hep un ah-lehr-GHEE for SOH-yah' },
  { en: 'Sesame', local: 'Ik heb een allergie voor sesam', say: 'ik hep un ah-lehr-GHEE for SEH-sahm' },
  { en: 'Celery', local: 'Ik heb een allergie voor selderij', say: 'ik hep un ah-lehr-GHEE for SEL-deh-ray' },
  { en: 'Mustard', local: 'Ik heb een allergie voor mosterd', say: 'ik hep un ah-lehr-GHEE for MOS-tert' },
  { en: 'Lupin', local: 'Ik heb een allergie voor lupine', say: 'ik hep un ah-lehr-GHEE for loo-PEE-neh' },
  { en: 'Sulphites', local: 'Ik heb een allergie voor sulfiet', say: 'ik hep un ah-lehr-GHEE for sool-FEET' },
];

const CROATIAN: AllergenPhrase[] = [
  { en: 'Peanuts', local: 'Imam alergiju na kikiriki', say: 'EE-mahm ah-LEHR-gee-yoo nah kee-kee-REE-kee' },
  { en: 'Tree nuts', local: 'Imam alergiju na orašaste plodove', say: 'EE-mahm ah-LEHR-gee-yoo nah oh-rah-SHAS-teh PLOH-doh-veh' },
  { en: 'Milk and dairy', local: 'Imam alergiju na mlijeko', say: 'EE-mahm ah-LEHR-gee-yoo nah MLYEH-koh' },
  { en: 'Eggs', local: 'Imam alergiju na jaja', say: 'EE-mahm ah-LEHR-gee-yoo nah YAH-yah' },
  { en: 'Fish', local: 'Imam alergiju na ribu', say: 'EE-mahm ah-LEHR-gee-yoo nah REE-boo' },
  { en: 'Shellfish', local: 'Imam alergiju na rakove', say: 'EE-mahm ah-LEHR-gee-yoo nah RAH-koh-veh' },
  { en: 'Molluscs', local: 'Imam alergiju na školjke', say: 'EE-mahm ah-LEHR-gee-yoo nah SHKOLY-keh' },
  { en: 'Gluten and wheat', local: 'Imam alergiju na gluten', say: 'EE-mahm ah-LEHR-gee-yoo nah GLOO-ten' },
  { en: 'Soya', local: 'Imam alergiju na soju', say: 'EE-mahm ah-LEHR-gee-yoo nah SOH-yoo' },
  { en: 'Sesame', local: 'Imam alergiju na sezam', say: 'EE-mahm ah-LEHR-gee-yoo nah SEH-zahm' },
  { en: 'Celery', local: 'Imam alergiju na celer', say: 'EE-mahm ah-LEHR-gee-yoo nah TSEH-lehr' },
  { en: 'Mustard', local: 'Imam alergiju na senf', say: 'EE-mahm ah-LEHR-gee-yoo nah SENF' },
  { en: 'Lupin', local: 'Imam alergiju na lupinu', say: 'EE-mahm ah-LEHR-gee-yoo nah loo-PEE-noo' },
  { en: 'Sulphites', local: 'Imam alergiju na sulfite', say: 'EE-mahm ah-LEHR-gee-yoo nah sool-FEE-teh' },
];

// Polish takes the accusative after "na": soja → soję, gorczyca → gorczycę.
const POLISH: AllergenPhrase[] = [
  { en: 'Peanuts', local: 'Mam alergię na orzeszki ziemne', say: 'mahm ah-LEHR-gyeh nah oh-ZHESH-kee ZHEM-neh' },
  { en: 'Tree nuts', local: 'Mam alergię na orzechy', say: 'mahm ah-LEHR-gyeh nah oh-ZHEH-khih' },
  { en: 'Milk and dairy', local: 'Mam alergię na mleko', say: 'mahm ah-LEHR-gyeh nah MLEH-koh' },
  { en: 'Eggs', local: 'Mam alergię na jajka', say: 'mahm ah-LEHR-gyeh nah YAI-kah' },
  { en: 'Fish', local: 'Mam alergię na ryby', say: 'mahm ah-LEHR-gyeh nah RIH-bih' },
  { en: 'Shellfish', local: 'Mam alergię na skorupiaki', say: 'mahm ah-LEHR-gyeh nah skoh-roo-PYAH-kee' },
  { en: 'Molluscs', local: 'Mam alergię na mięczaki', say: 'mahm ah-LEHR-gyeh nah myen-CHAH-kee' },
  { en: 'Gluten and wheat', local: 'Mam alergię na gluten', say: 'mahm ah-LEHR-gyeh nah GLOO-ten' },
  { en: 'Soya', local: 'Mam alergię na soję', say: 'mahm ah-LEHR-gyeh nah SOH-yeh' },
  { en: 'Sesame', local: 'Mam alergię na sezam', say: 'mahm ah-LEHR-gyeh nah SEH-zahm' },
  { en: 'Celery', local: 'Mam alergię na seler', say: 'mahm ah-LEHR-gyeh nah SEH-lehr' },
  { en: 'Mustard', local: 'Mam alergię na gorczycę', say: 'mahm ah-LEHR-gyeh nah gor-CHIH-tseh' },
  { en: 'Lupin', local: 'Mam alergię na łubin', say: 'mahm ah-LEHR-gyeh nah WOO-been' },
  { en: 'Sulphites', local: 'Mam alergię na siarczyny', say: 'mahm ah-LEHR-gyeh nah shar-CHIH-nih' },
];

// The polite Thai pronoun is gendered (ผม for a man, ดิฉัน for a woman), so it
// is left off here — normal in speech, and it keeps one line serving everyone.
const THAI: AllergenPhrase[] = [
  { en: 'Peanuts', local: 'แพ้ถั่วลิสง', say: 'páe tùa-lí-sǒng' },
  { en: 'Tree nuts', local: 'แพ้ถั่วเปลือกแข็ง', say: 'páe tùa-plùeak-kǎeng' },
  { en: 'Milk and dairy', local: 'แพ้นม', say: 'páe nom' },
  { en: 'Eggs', local: 'แพ้ไข่', say: 'páe kài' },
  { en: 'Fish', local: 'แพ้ปลา', say: 'páe plaa' },
  { en: 'Shellfish', local: 'แพ้กุ้งและปู', say: 'páe gûng láe bpuu', note: 'Literally prawns and crab — the two a kitchen will picture straight away.' },
  { en: 'Molluscs', local: 'แพ้หอย', say: 'páe hɔ̌ɔi' },
  { en: 'Gluten and wheat', local: 'แพ้กลูเตน', say: 'páe gluu-dten' },
  { en: 'Soya', local: 'แพ้ถั่วเหลือง', say: 'páe tùa-lǔeang', note: 'Soy sauce is in a great deal of Thai cooking. Worth saying twice.' },
  { en: 'Sesame', local: 'แพ้งา', say: 'páe ngaa' },
  { en: 'Celery', local: 'แพ้ขึ้นฉ่าย', say: 'páe khûen-chàai' },
  { en: 'Mustard', local: 'แพ้มัสตาร์ด', say: 'páe mát-sà-dtàat' },
  { en: 'Lupin', local: 'แพ้ถั่วลูพิน', say: 'páe tùa-luu-pin' },
  { en: 'Sulphites', local: 'แพ้ซัลไฟต์', say: 'páe san-fái' },
];

const ARABIC: AllergenPhrase[] = [
  { en: 'Peanuts', local: 'عندي حساسية من الفول السوداني', say: 'IN-dee ha-sa-SEE-ya min al-fool as-soo-DAH-nee' },
  { en: 'Tree nuts', local: 'عندي حساسية من المكسرات', say: 'IN-dee ha-sa-SEE-ya min al-mu-kas-sa-RAAT' },
  { en: 'Milk and dairy', local: 'عندي حساسية من الحليب', say: 'IN-dee ha-sa-SEE-ya min al-ha-LEEB' },
  { en: 'Eggs', local: 'عندي حساسية من البيض', say: 'IN-dee ha-sa-SEE-ya min al-BAYD' },
  { en: 'Fish', local: 'عندي حساسية من السمك', say: 'IN-dee ha-sa-SEE-ya min as-SA-mak' },
  { en: 'Shellfish', local: 'عندي حساسية من المأكولات البحرية', say: 'IN-dee ha-sa-SEE-ya min al-ma-koo-LAAT al-bah-ree-YA', note: 'This says seafood generally. Deliberately broad — safer than a term a cook may not know.' },
  { en: 'Molluscs', local: 'عندي حساسية من الرخويات', say: 'IN-dee ha-sa-SEE-ya min ar-rakh-wee-YAAT' },
  { en: 'Gluten and wheat', local: 'عندي حساسية من الغلوتين', say: 'IN-dee ha-sa-SEE-ya min al-ghloo-TEEN' },
  { en: 'Soya', local: 'عندي حساسية من الصويا', say: 'IN-dee ha-sa-SEE-ya min as-SOY-ah' },
  { en: 'Sesame', local: 'عندي حساسية من السمسم', say: 'IN-dee ha-sa-SEE-ya min as-SIM-sim', note: 'Sesame is in tahini and so in hummus, halva and much else.' },
  { en: 'Celery', local: 'عندي حساسية من الكرفس', say: 'IN-dee ha-sa-SEE-ya min al-KA-rafs' },
  { en: 'Mustard', local: 'عندي حساسية من الخردل', say: 'IN-dee ha-sa-SEE-ya min al-KHAR-dal' },
  { en: 'Lupin', local: 'عندي حساسية من الترمس', say: 'IN-dee ha-sa-SEE-ya min at-TUR-mus' },
  { en: 'Sulphites', local: 'عندي حساسية من الكبريتيت', say: 'IN-dee ha-sa-SEE-ya min al-kib-ree-TEET' },
];

/** Keyed on the phrase set's own language name, so the two cannot drift apart. */
const BY_LANGUAGE: Record<string, AllergenPhrase[]> = {
  Spanish: SPANISH,
  French: FRENCH,
  Italian: ITALIAN,
  Portuguese: PORTUGUESE,
  German: GERMAN,
  Greek: GREEK,
  Turkish: TURKISH,
  Dutch: DUTCH,
  Croatian: CROATIAN,
  Polish: POLISH,
  Thai: THAI,
  Arabic: ARABIC,
};

/** The fourteen, in the order they are offered. Peanuts first: it is the one. */
export const ALLERGEN_ORDER = SPANISH.map((a) => a.en);

export function allergensFor(language: string | null | undefined): AllergenPhrase[] | null {
  const key = (language || '').trim();
  return BY_LANGUAGE[key] ?? null;
}

/**
 * A line to show alongside the phrase, in English, for the person reading it.
 *
 * Deliberately not a translation: it is for the traveller, reminding them that
 * showing the screen beats pronouncing it. Speaking a word wrong is how an
 * allergy gets heard as a preference.
 */
export const SHOW_DONT_SAY =
  'Show this screen to whoever is serving you. Reading it aloud is a second best — a mispronounced word can turn an allergy into a preference.';
