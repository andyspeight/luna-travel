/**
 * The phrase book.
 *
 * Keyed on LANGUAGE, not destination. Spanish is Spanish whether the booking is
 * Tenerife, Mexico or Peru, so one set serves every Spanish-speaking record in
 * the content base and a new Spanish destination needs nothing written for it.
 * The destination's own "Language" field is what selects the set.
 *
 * Every non-Latin script carries a pronunciation line, because a phrase book
 * you cannot say out loud is decoration. Speaking is handled by the device's
 * own speech synthesiser — no network, no audio files, works on a plane.
 *
 * REVIEW STATUS: these were written in-house and want a native speaker's pass
 * before they are promoted in marketing, the same gate the multi-language work
 * uses. They are the most standard phrases in travel and the risk is low, but
 * "low" is not "checked". `reviewedBy` records who has looked at each one.
 */

export interface Phrase {
  /** What a British traveller wants to say. */
  en: string;
  /** In the local language, in its own script. */
  local: string;
  /** How to say it. Only where the script is not Latin, or the spelling lies. */
  say?: string;
  /** Anything that catches people out. */
  note?: string;
}

export interface PhraseSet {
  /** Display name, as the content base writes it. */
  language: string;
  /** BCP-47 tag for speechSynthesis. */
  speechLang: string;
  /** Empty until a native speaker has been through it. */
  reviewedBy: string;
  groups: Array<{ title: string; phrases: Phrase[] }>;
}

const SPANISH: PhraseSet = {
  language: 'Spanish',
  speechLang: 'es-ES',
  reviewedBy: '',
  groups: [
    {
      title: 'The basics',
      phrases: [
        { en: 'Hello', local: 'Hola', say: 'OH-lah' },
        { en: 'Please', local: 'Por favor', say: 'por fah-BOR' },
        { en: 'Thank you', local: 'Gracias', say: 'GRAH-syas' },
        { en: 'Yes / No', local: 'Sí / No', say: 'see / noh' },
        { en: 'Excuse me', local: 'Perdone', say: 'per-DOH-neh' },
        { en: 'Do you speak English?', local: '¿Habla inglés?', say: 'AH-blah een-GLESS' },
      ],
    },
    {
      title: 'Out and about',
      phrases: [
        { en: 'How much is it?', local: '¿Cuánto cuesta?', say: 'KWAN-toh KWES-tah' },
        { en: 'The bill, please', local: 'La cuenta, por favor', say: 'lah KWEN-tah' },
        { en: 'Where is the toilet?', local: '¿Dónde está el baño?', say: 'DON-deh es-TAH el BAH-nyoh' },
      ],
    },
    {
      title: 'If something goes wrong',
      phrases: [
        { en: "I'm allergic to…", local: 'Soy alérgico a…', say: 'soy ah-LEHR-hee-koh ah', note: 'A woman says alérgica' },
        { en: 'I need a doctor', local: 'Necesito un médico', say: 'neh-seh-SEE-toh oon MEH-dee-koh' },
        { en: 'Help!', local: '¡Ayuda!', say: 'ah-YOO-dah' },
      ],
    },
  ],
};

const FRENCH: PhraseSet = {
  language: 'French',
  speechLang: 'fr-FR',
  reviewedBy: '',
  groups: [
    {
      title: 'The basics',
      phrases: [
        { en: 'Hello', local: 'Bonjour', say: 'bon-ZHOOR', note: 'Say it on entering a shop — leaving it out reads as rude' },
        { en: 'Please', local: "S'il vous plaît", say: 'seel voo PLEH' },
        { en: 'Thank you', local: 'Merci', say: 'mehr-SEE' },
        { en: 'Yes / No', local: 'Oui / Non', say: 'wee / non' },
        { en: 'Excuse me', local: 'Excusez-moi', say: 'ex-kew-zay MWAH' },
        { en: 'Do you speak English?', local: 'Parlez-vous anglais ?', say: 'par-lay voo on-GLEH' },
      ],
    },
    {
      title: 'Out and about',
      phrases: [
        { en: 'How much is it?', local: "C'est combien ?", say: 'say kom-BYEN' },
        { en: 'The bill, please', local: "L'addition, s'il vous plaît", say: 'lah-dee-SYON' },
        { en: 'Where is the toilet?', local: 'Où sont les toilettes ?', say: 'oo son lay twah-LET' },
      ],
    },
    {
      title: 'If something goes wrong',
      phrases: [
        { en: "I'm allergic to…", local: 'Je suis allergique à…', say: 'zhuh swee ah-lehr-ZHEEK ah' },
        { en: 'I need a doctor', local: "J'ai besoin d'un médecin", say: 'zhay buh-ZWAN dun med-SAN' },
        { en: 'Help!', local: 'Au secours !', say: 'oh suh-KOOR' },
      ],
    },
  ],
};

const ITALIAN: PhraseSet = {
  language: 'Italian',
  speechLang: 'it-IT',
  reviewedBy: '',
  groups: [
    {
      title: 'The basics',
      phrases: [
        { en: 'Hello', local: 'Buongiorno', say: 'bwon-JOR-noh', note: 'Buonasera from late afternoon' },
        { en: 'Please', local: 'Per favore', say: 'per fah-VOH-reh' },
        { en: 'Thank you', local: 'Grazie', say: 'GRAH-tsyeh' },
        { en: 'Yes / No', local: 'Sì / No', say: 'see / noh' },
        { en: 'Excuse me', local: 'Mi scusi', say: 'mee SKOO-zee' },
        { en: 'Do you speak English?', local: 'Parla inglese?', say: 'PAR-lah een-GLEH-zeh' },
      ],
    },
    {
      title: 'Out and about',
      phrases: [
        { en: 'How much is it?', local: 'Quanto costa?', say: 'KWAN-toh KOS-tah' },
        { en: 'The bill, please', local: 'Il conto, per favore', say: 'eel KON-toh' },
        { en: 'Where is the toilet?', local: "Dov'è il bagno?", say: 'doh-VEH eel BAH-nyoh' },
      ],
    },
    {
      title: 'If something goes wrong',
      phrases: [
        { en: "I'm allergic to…", local: 'Sono allergico a…', say: 'SOH-noh al-LEHR-jee-koh ah', note: 'A woman says allergica' },
        { en: 'I need a doctor', local: 'Ho bisogno di un medico', say: 'oh bee-ZOH-nyoh dee oon MEH-dee-koh' },
        { en: 'Help!', local: 'Aiuto!', say: 'ah-YOO-toh' },
      ],
    },
  ],
};

const PORTUGUESE: PhraseSet = {
  language: 'Portuguese',
  speechLang: 'pt-PT',
  reviewedBy: '',
  groups: [
    {
      title: 'The basics',
      phrases: [
        { en: 'Hello', local: 'Olá', say: 'oh-LAH' },
        { en: 'Please', local: 'Por favor', say: 'poor fah-VOR' },
        { en: 'Thank you', local: 'Obrigado / Obrigada', say: 'oh-bree-GAH-doo / -dah', note: 'Men say obrigado, women obrigada — it agrees with the speaker' },
        { en: 'Yes / No', local: 'Sim / Não', say: 'seeng / nowng' },
        { en: 'Excuse me', local: 'Desculpe', say: 'desh-KOOL-peh' },
        { en: 'Do you speak English?', local: 'Fala inglês?', say: 'FAH-lah een-GLESH' },
      ],
    },
    {
      title: 'Out and about',
      phrases: [
        { en: 'How much is it?', local: 'Quanto custa?', say: 'KWAN-too KOOSH-tah' },
        { en: 'The bill, please', local: 'A conta, por favor', say: 'ah KON-tah' },
        { en: 'Where is the toilet?', local: 'Onde é a casa de banho?', say: 'ON-deh eh ah KAH-zah deh BAH-nyoo', note: 'In Brazil, banheiro' },
      ],
    },
    {
      title: 'If something goes wrong',
      phrases: [
        { en: "I'm allergic to…", local: 'Sou alérgico a…', say: 'soh ah-LEHR-zhee-koo ah' },
        { en: 'I need a doctor', local: 'Preciso de um médico', say: 'preh-SEE-zoo deh oong MEH-dee-koo' },
        { en: 'Help!', local: 'Socorro!', say: 'soo-KOH-rroo' },
      ],
    },
  ],
};

const GERMAN: PhraseSet = {
  language: 'German',
  speechLang: 'de-DE',
  reviewedBy: '',
  groups: [
    {
      title: 'The basics',
      phrases: [
        { en: 'Hello', local: 'Guten Tag', say: 'GOO-ten TAHK' },
        { en: 'Please', local: 'Bitte', say: 'BIT-teh' },
        { en: 'Thank you', local: 'Danke', say: 'DAN-keh' },
        { en: 'Yes / No', local: 'Ja / Nein', say: 'yah / nine' },
        { en: 'Excuse me', local: 'Entschuldigung', say: 'ent-SHOOL-dee-goong' },
        { en: 'Do you speak English?', local: 'Sprechen Sie Englisch?', say: 'SHPREH-khen zee ENG-lish' },
      ],
    },
    {
      title: 'Out and about',
      phrases: [
        { en: 'How much is it?', local: 'Was kostet das?', say: 'vas KOS-tet das' },
        { en: 'The bill, please', local: 'Die Rechnung, bitte', say: 'dee REKH-noong' },
        { en: 'Where is the toilet?', local: 'Wo ist die Toilette?', say: 'voh ist dee toy-LET-teh' },
      ],
    },
    {
      title: 'If something goes wrong',
      phrases: [
        { en: "I'm allergic to…", local: 'Ich bin allergisch gegen…', say: 'ikh bin ah-LEHR-gish GAY-gen' },
        { en: 'I need a doctor', local: 'Ich brauche einen Arzt', say: 'ikh BROW-kheh INE-en ARTST' },
        { en: 'Help!', local: 'Hilfe!', say: 'HIL-feh' },
      ],
    },
  ],
};

const GREEK: PhraseSet = {
  language: 'Greek',
  speechLang: 'el-GR',
  reviewedBy: '',
  groups: [
    {
      title: 'The basics',
      phrases: [
        { en: 'Hello', local: 'Γεια σας', say: 'yah sahs' },
        { en: 'Please', local: 'Παρακαλώ', say: 'pah-rah-kah-LOH', note: 'Also means "you\'re welcome" and "can I help you?"' },
        { en: 'Thank you', local: 'Ευχαριστώ', say: 'ef-hah-ree-STOH' },
        { en: 'Yes / No', local: 'Ναι / Όχι', say: 'neh / OH-hee', note: 'Ναι means YES, however much it sounds like "nay"' },
        { en: 'Excuse me', local: 'Συγγνώμη', say: 'see-GHNO-mee' },
        { en: 'Do you speak English?', local: 'Μιλάτε αγγλικά;', say: 'mee-LAH-teh ang-glee-KAH' },
      ],
    },
    {
      title: 'Out and about',
      phrases: [
        { en: 'How much is it?', local: 'Πόσο κάνει;', say: 'POH-soh KAH-nee' },
        { en: 'The bill, please', local: 'Τον λογαριασμό, παρακαλώ', say: 'ton loh-gah-ryahz-MOH' },
        { en: 'Where is the toilet?', local: 'Πού είναι η τουαλέτα;', say: 'poo EE-neh ee too-ah-LEH-tah' },
      ],
    },
    {
      title: 'If something goes wrong',
      phrases: [
        { en: "I'm allergic to…", local: 'Είμαι αλλεργικός σε…', say: 'EE-meh ah-lehr-yee-KOSS seh', note: 'A woman says αλλεργική, ah-lehr-yee-KEE' },
        { en: 'I need a doctor', local: 'Χρειάζομαι γιατρό', say: 'hree-AH-zoh-meh yah-TROH' },
        { en: 'Help!', local: 'Βοήθεια!', say: 'vo-EE-thee-ah' },
      ],
    },
  ],
};

const TURKISH: PhraseSet = {
  language: 'Turkish',
  speechLang: 'tr-TR',
  reviewedBy: '',
  groups: [
    {
      title: 'The basics',
      phrases: [
        { en: 'Hello', local: 'Merhaba', say: 'MER-hah-bah' },
        { en: 'Please', local: 'Lütfen', say: 'LEWT-fen' },
        { en: 'Thank you', local: 'Teşekkürler', say: 'teh-sheh-kewr-LEHR' },
        { en: 'Yes / No', local: 'Evet / Hayır', say: 'eh-VET / HAH-yuhr' },
        { en: 'Excuse me', local: 'Affedersiniz', say: 'af-feh-DER-see-neez' },
        { en: 'Do you speak English?', local: 'İngilizce biliyor musunuz?', say: 'een-gee-LEEZ-jeh bee-lee-YOR moo-soo-nooz' },
      ],
    },
    {
      title: 'Out and about',
      phrases: [
        { en: 'How much is it?', local: 'Ne kadar?', say: 'neh kah-DAR' },
        { en: 'The bill, please', local: 'Hesap, lütfen', say: 'heh-SAP' },
        { en: 'Where is the toilet?', local: 'Tuvalet nerede?', say: 'too-vah-LET NEH-reh-deh' },
      ],
    },
    {
      title: 'If something goes wrong',
      phrases: [
        { en: "I'm allergic to…", local: '…alerjim var', say: 'ah-ler-ZHEEM var', note: 'The thing goes first: "Fıstık alerjim var" — I have a nut allergy' },
        { en: 'I need a doctor', local: 'Doktora ihtiyacım var', say: 'dok-toh-RAH eeh-tee-yah-JUHM var' },
        { en: 'Help!', local: 'İmdat!', say: 'eem-DAT' },
      ],
    },
  ],
};

const DUTCH: PhraseSet = {
  language: 'Dutch',
  speechLang: 'nl-NL',
  reviewedBy: '',
  groups: [
    {
      title: 'The basics',
      phrases: [
        { en: 'Hello', local: 'Hallo', say: 'HAH-loh' },
        { en: 'Please', local: 'Alstublieft', say: 'AHL-stu-bleeft' },
        { en: 'Thank you', local: 'Dank u wel', say: 'dank ew VEL' },
        { en: 'Yes / No', local: 'Ja / Nee', say: 'yah / nay' },
        { en: 'Excuse me', local: 'Pardon', say: 'par-DON' },
        { en: 'Do you speak English?', local: 'Spreekt u Engels?', say: 'spraykt ew ENG-uls', note: 'Almost certainly yes' },
      ],
    },
    {
      title: 'Out and about',
      phrases: [
        { en: 'How much is it?', local: 'Hoeveel kost het?', say: 'HOO-vayl kost het' },
        { en: 'The bill, please', local: 'De rekening, alstublieft', say: 'deh RAY-kuh-ning' },
        { en: 'Where is the toilet?', local: 'Waar is het toilet?', say: 'vahr is het twah-LET' },
      ],
    },
    {
      title: 'If something goes wrong',
      phrases: [
        { en: "I'm allergic to…", local: 'Ik ben allergisch voor…', say: 'ik ben ah-LEHR-gees for' },
        { en: 'I need a doctor', local: 'Ik heb een dokter nodig', say: 'ik heb un DOK-ter NOH-dukh' },
        { en: 'Help!', local: 'Help!', say: 'help' },
      ],
    },
  ],
};

const CROATIAN: PhraseSet = {
  language: 'Croatian',
  speechLang: 'hr-HR',
  reviewedBy: '',
  groups: [
    {
      title: 'The basics',
      phrases: [
        { en: 'Hello', local: 'Dobar dan', say: 'DOH-bar dahn' },
        { en: 'Please', local: 'Molim', say: 'MOH-leem' },
        { en: 'Thank you', local: 'Hvala', say: 'HVAH-lah' },
        { en: 'Yes / No', local: 'Da / Ne', say: 'dah / neh' },
        { en: 'Excuse me', local: 'Oprostite', say: 'oh-PROS-tee-teh' },
        { en: 'Do you speak English?', local: 'Govorite li engleski?', say: 'GOH-voh-ree-teh lee EN-gles-kee' },
      ],
    },
    {
      title: 'Out and about',
      phrases: [
        { en: 'How much is it?', local: 'Koliko košta?', say: 'KOH-lee-koh KOSH-tah' },
        { en: 'The bill, please', local: 'Račun, molim', say: 'RAH-choon' },
        { en: 'Where is the toilet?', local: 'Gdje je WC?', say: 'g-dyeh yeh VEH-tseh', note: 'WC is said "veh-tseh"' },
      ],
    },
    {
      title: 'If something goes wrong',
      phrases: [
        { en: "I'm allergic to…", local: 'Alergičan sam na…', say: 'ah-LEHR-gee-chan sam nah', note: 'A woman says alergična' },
        { en: 'I need a doctor', local: 'Trebam liječnika', say: 'TREH-bam lee-YECH-nee-kah' },
        { en: 'Help!', local: 'Upomoć!', say: 'OO-poh-moch' },
      ],
    },
  ],
};

const POLISH: PhraseSet = {
  language: 'Polish',
  speechLang: 'pl-PL',
  reviewedBy: '',
  groups: [
    {
      title: 'The basics',
      phrases: [
        { en: 'Hello', local: 'Dzień dobry', say: 'jayn DOH-bri' },
        { en: 'Please', local: 'Proszę', say: 'PROH-sheh' },
        { en: 'Thank you', local: 'Dziękuję', say: 'jen-KOO-yeh' },
        { en: 'Yes / No', local: 'Tak / Nie', say: 'tahk / nyeh' },
        { en: 'Excuse me', local: 'Przepraszam', say: 'psheh-PRAH-shahm' },
        { en: 'Do you speak English?', local: 'Czy mówi pan po angielsku?', say: 'chi MOO-vee pahn poh ahn-GYEL-skoo', note: 'To a woman, pani rather than pan' },
      ],
    },
    {
      title: 'Out and about',
      phrases: [
        { en: 'How much is it?', local: 'Ile to kosztuje?', say: 'EE-leh toh kosh-TOO-yeh' },
        { en: 'The bill, please', local: 'Rachunek, proszę', say: 'rah-HOO-nek' },
        { en: 'Where is the toilet?', local: 'Gdzie jest toaleta?', say: 'g-jeh yest toh-ah-LEH-tah' },
      ],
    },
    {
      title: 'If something goes wrong',
      phrases: [
        { en: "I'm allergic to…", local: 'Mam alergię na…', say: 'mahm ah-LEHR-gyeh nah' },
        { en: 'I need a doctor', local: 'Potrzebuję lekarza', say: 'poh-tsheh-BOO-yeh leh-KAH-zhah' },
        { en: 'Help!', local: 'Pomocy!', say: 'poh-MOH-tsi' },
      ],
    },
  ],
};

const THAI: PhraseSet = {
  language: 'Thai',
  speechLang: 'th-TH',
  reviewedBy: '',
  groups: [
    {
      title: 'The basics',
      phrases: [
        { en: 'Hello', local: 'สวัสดี', say: 'sa-wat-DEE', note: 'Add ครับ (kráp) if you are a man, ค่ะ (kâ) if a woman — it is what makes it polite' },
        { en: 'Please', local: 'กรุณา', say: 'ga-ru-NA' },
        { en: 'Thank you', local: 'ขอบคุณ', say: 'kòp-KOON' },
        { en: 'Yes / No', local: 'ใช่ / ไม่', say: 'châi / mâi' },
        { en: 'Excuse me', local: 'ขอโทษ', say: 'kŏr-TÔHT' },
        { en: 'Do you speak English?', local: 'คุณพูดภาษาอังกฤษได้ไหม', say: 'koon pôot pa-săa ang-grìt dâi măi' },
      ],
    },
    {
      title: 'Out and about',
      phrases: [
        { en: 'How much is it?', local: 'เท่าไหร่', say: 'tâo-RÀI' },
        { en: 'The bill, please', local: 'เช็คบิล', say: 'check bin' },
        { en: 'Where is the toilet?', local: 'ห้องน้ำอยู่ที่ไหน', say: 'hông-náam yòo têe-NĂI' },
      ],
    },
    {
      title: 'If something goes wrong',
      phrases: [
        { en: "I'm allergic to…", local: 'ผมแพ้…', say: 'pŏm páe', note: 'A woman says ดิฉันแพ้ (di-chăn páe)' },
        { en: 'I need a doctor', local: 'ต้องการหมอ', say: 'tông-gaan MŎR' },
        { en: 'Help!', local: 'ช่วยด้วย', say: 'chûay-DÛAY' },
      ],
    },
  ],
};

const ARABIC: PhraseSet = {
  language: 'Arabic',
  speechLang: 'ar',
  reviewedBy: '',
  groups: [
    {
      title: 'The basics',
      phrases: [
        { en: 'Hello', local: 'مرحبا', say: 'MAR-ha-ban' },
        { en: 'Please', local: 'من فضلك', say: 'min FAD-lik', note: 'To a woman, min FAD-lik-i' },
        { en: 'Thank you', local: 'شكرا', say: 'SHUK-ran' },
        { en: 'Yes / No', local: 'نعم / لا', say: 'NA-am / laa' },
        { en: 'Excuse me', local: 'عفوا', say: 'AF-wan' },
        { en: 'Do you speak English?', local: 'هل تتكلم الإنجليزية؟', say: 'hal ta-ta-KAL-lam al-in-gi-LEE-zee-ya' },
      ],
    },
    {
      title: 'Out and about',
      phrases: [
        { en: 'How much is it?', local: 'بكم هذا؟', say: 'bi-KAM HAA-dha' },
        { en: 'The bill, please', local: 'الحساب من فضلك', say: 'al-hi-SAAB min FAD-lik' },
        { en: 'Where is the toilet?', local: 'أين الحمام؟', say: 'AY-na al-ham-MAAM' },
      ],
    },
    {
      title: 'If something goes wrong',
      phrases: [
        { en: "I'm allergic to…", local: 'عندي حساسية من…', say: 'IN-dee ha-sa-SEE-ya min' },
        { en: 'I need a doctor', local: 'أحتاج طبيبا', say: 'ah-TAAJ ta-BEE-ban' },
        { en: 'Help!', local: 'النجدة', say: 'an-NAJ-da' },
      ],
    },
  ],
};

/**
 * Every set, and the words in a "Language" cell that select it.
 *
 * Order matters: the first match in the cell wins, and the cell is written
 * most-spoken-first ("Sinhala, Tamil, English"). English is deliberately absent
 * — a phrase book for somewhere they already speak your language is clutter.
 */
const SETS: Array<{ match: RegExp; set: PhraseSet }> = [
  { match: /\bspanish\b|\bcastilian\b/i, set: SPANISH },
  { match: /\bfrench\b/i, set: FRENCH },
  { match: /\bitalian\b/i, set: ITALIAN },
  { match: /\bportuguese\b/i, set: PORTUGUESE },
  { match: /\bgerman\b/i, set: GERMAN },
  { match: /\bgreek\b/i, set: GREEK },
  { match: /\bturkish\b/i, set: TURKISH },
  { match: /\bdutch\b/i, set: DUTCH },
  { match: /\bcroatian\b/i, set: CROATIAN },
  { match: /\bpolish\b/i, set: POLISH },
  { match: /\bthai\b/i, set: THAI },
  { match: /\barabic\b/i, set: ARABIC },
];

export const PHRASE_LANGUAGES = SETS.map((s) => s.set.language);

/**
 * The set for a destination's "Language" cell, or null.
 *
 * Null is a normal outcome, not a failure: Barbados speaks English, and Laos
 * speaks a language we have no set for. Both should show no phrase book rather
 * than an apology.
 */
export function phrasesFor(languageLabel: string | null | undefined): PhraseSet | null {
  const label = (languageLabel || '').trim();
  if (!label) return null;

  // Follow the cell's own order, so "Dutch, French" gives Dutch and
  // "French, Tahitian" gives French.
  const parts = label.split(/[,/]/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const hit = SETS.find((s) => s.match.test(part));
    if (hit) return hit.set;
  }
  return SETS.find((s) => s.match.test(label))?.set ?? null;
}
