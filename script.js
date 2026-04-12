// Herní stav
let gameState = {
    score: 0,
    lives: 3,
    step: 0,
    isTyping: false,
    blocks: []
};

const QUESTION_POOL = [
    {
        q: "Co označuje G-kód v NC programu?",
        options: ["Geometrické funkce", "Technologické parametry", "Identifikaci nástroje"]
    },
    {
        q: "Který M-kód zapíná otáčky vřetena po směru hodinových ručiček?",
        options: ["M3", "M8", "M30"]
    },
    {
        q: "Co znamená příkaz G0?",
        options: ["Rychloposuv bez záběru do materiálu", "Kruhová interpolace", "Pracovní posuv"]
    },
    {
        q: "Jakým příkazem vypneme chlazení (emulzi)?",
        options: ["M9", "M8", "M0"]
    },
    {
        q: "Jaká je standardní jednotka pro definici posuvu F při soustružení?",
        options: ["mm/ot", "m/min", "mm/min"]
    },
    {
        q: "Který příkaz aktivuje korekci poloměru břitu nástroje vlevo od kontury?",
        options: ["G41", "G40", "G42"]
    },
    {
        q: "Co je to NC program?",
        options: ["Textový soubor/jazyk", "Grafika", "Seznam údržby"]
    },
    {
        q: "Jaké informace tvoří NC program?",
        options: ["Technologické a geometrické", "Mechanické a elektrické", "Vstupní a výstupní"]
    },
    {
        q: "Co jsou geometrické informace?",
        options: ["Tvar součásti a pohyby nástrojů", "Seznam materiálů", "Směny u stroje"]
    },
    {
        q: "Která norma stanovuje zásady programování NC?",
        options: ["ISO 6983", "9001", "12100"]
    },
    {
        q: "Jaký je rozdíl mezi podprogramem a cyklem?",
        options: ["Podprogram je opakovatelný, cyklus je pevně stanoven výrobcem", "Cyklus počítá dráhy", "Jsou to synonyma"]
    }
];

function shuffleArray(array) {
    let arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

let rescueMode = {
    active: false,
    currentQuestion: 0,
    questions: []
};

// Regex Parser s pokročilými slovními obraty
function parseCommand(str) {
    const s = str.toUpperCase().replace(/\s+/g, ' '); // normalizace na formát bez mezer navíc

    const getVal = (char) => {
        const match = s.match(new RegExp(`${char}(-?\\d+\\.?\\d*)`));
        return match ? parseFloat(match[1]) : null;
    };

    const hasG = (num) => new RegExp(`\\bG0?${num}\\b`).test(s);
    const hasM = (num) => new RegExp(`\\bM0?${num}\\b`).test(s);

    return {
        n: getVal('N'),
        x: getVal('X'), z: getVal('Z'),
        r: getVal('R'), f: getVal('F'),
        i: getVal('I'), k: getVal('K'), s: getVal('S'),
        hasWorkpiece: s.includes('WORKPIECE'),
        hasCycle62: s.includes('CYCLE62'),
        hasCycle952: s.includes('CYCLE952'),
        hasCycle930: s.includes('CYCLE930'),
        hasCycle92: s.includes('CYCLE92'),
        hasToolHrubovaci: s.includes('HRUBOVACI'),

        g90: hasG(90), g54: hasG(54),
        g41: hasG(41), g40: hasG(40),
        g0: hasG(0), g1: hasG(1), g2: hasG(2), g3: hasG(3),

        m3: hasM(3), m8: hasM(8), m30: hasM(30),
        raw: s
    };
}

const STEPS = [
    // FÁZE 1
    {
        story: "FÁZE 1: PŘÍPRAVA. Nacházíš se u terminálu Master Programu Dr. Axela. Systém čeká na inicializaci surového monobloku.",
        tech: "ÚLOHA: Zadej instrukci pro definici polotovaru. Blok v ŘS systému drží jediné komunikační heslo programu materiálu.",
        fact: "💡 [NC FAKT]: Úvodní řádek specifikuje fyzické rozměry polotovaru pro následné zpracování obrobkových cyklů.",
        verify: (cmd) => {
            if (cmd.hasWorkpiece) return { success: true, msg: "Polotovar zaveden do paměti ŘS." };
            return { success: false, msg: "ALARM: Chybí identifikátor WORKPIECE.", lifeLoss: false };
        }
    },
    {
        story: "Prostor obrobku definován.",
        tech: "ÚLOHA: Odesílateli, uzamkni absoltuní odměřování kódu a aktivuj první posunutí nulového bodu.",
        fact: "💡 [NC FAKT]: Volba absolutního programování a transformace vztažného bodu M na vztažný bod W výchozí polohy programování (nulový bod obrobku).",
        verify: (cmd) => {
            if (cmd.g90 && cmd.g54) return { success: true, msg: "Absolutní programování aktivováno, nastavení nulového bodu W." };
            return { success: false, msg: "ALARM: Požadováno uzamčení souřadnic G90 společně s referencí G54.", lifeLoss: false };
        }
    },
    {
        story: "Nulový bod kalibrován. Systém požaduje technologická data.",
        tech: "ÚLOHA: Zvol název nástroje T (zapiš HRUBOVACI), otáčky vřetena na 1200, posuv na 0.2 a rozjeď vřeteno ve směru hod. ručiček.",
        fact: "💡 [NC FAKT]: Dichotomie kódu odděluje technologii od geometrie; zde určujete podmínky řezu stroje.",
        verify: (cmd) => {
            if (cmd.hasToolHrubovaci && cmd.s === 1200 && cmd.f === 0.2 && cmd.m3) return { success: true, msg: "[TECH. DATA]: Přijato. Vřeteno v rotaci." };
            return { success: false, msg: "ALARM: Technologická data nesouhlasí. Zadejte T, S1200, F0.2 a M3.", lifeLoss: false };
        }
    },
    {
        story: "Nástroj sviští směrem k obrobku.",
        tech: "ÚLOHA: Bezpečný nájezd k materiálu! Chci rychloposuv přesně nad referenční průměr X32 a hranu Z0. Znovu zapněte rotaci vřetena a spusťte emulzi chlazení oběma M-kódy.",
        fact: "💡 [NC FAKT]: Synchronní volání G0 s parametry chlazení zabrání tepelnému rázu v následujícím řezu.",
        verify: (cmd) => {
            if (cmd.g0 && cmd.x === 32 && cmd.z === 0 && cmd.m3 && cmd.m8) return { success: true, msg: "Trysky spuštěny, nástroj vyčkává na X32." };
            return { success: false, msg: "ALARM: Chybí najetí na pozici nebo M3 M8.", lifeLoss: true };
        }
    },
    {
        story: "Teplota břitu je stabilní v lázni chlazení.",
        tech: "ÚLOHA: Vyrovnej letokruhy přesnosti aktivací dráhové korekce vlevo od kontury - zapni korekci poloměru břitu nástroje.",
        fact: "💡 [NC FAKT]: Zapnutím korekce simulujeme fantomový nástroj, kde ŘS sám posune souřadnice vůči hraně destičky.",
        verify: (cmd) => {
            if (cmd.g41) return { success: true, msg: "Korekce G41 aplikována, \"hrana\" nástroje nalezena a započítána." };
            return { success: false, msg: "ALARM: Zadejte instrukci G41 pro aktivaci poloměrové korekce.", lifeLoss: false };
        }
    },
    {
        story: "První reálný profil.",
        tech: "ÚLOHA: Zarovnej čelo. Najeď s řezným posuvem hlouběji mírně pod střed otáčení, abychom odstranili nálitky. Cíl pro zarovnání průměru je X-0.8 a délka stále Z0.",
        fact: "💡 [NC FAKT]: Abychom neponechali na čele tzv. špičku z radiusu břitu, sjíždíme přesně o – poloměr břitové destičky",
        verify: (cmd) => {
            if (cmd.g1 && cmd.x === -0.8 && cmd.z === 0) return { success: true, msg: "Čelní profil čistě odsoustružen do absolutní hladkosti." };
            return { success: false, msg: "Kolize na zarovnání čela! Pracuj s G1.", lifeLoss: true };
        }
    },
    {
        story: "Opracování čela dokončeno.",
        tech: "ÚLOHA: Pro další operace odstraň korekci nástroje. Blok nese jednoduchou a tvrdou instrukci zrušení korekce.",
        fact: "💡 [NC FAKT]: Po každé ucelené operaci je vhodné zrušit geometrický ofset proti srážce v dalším najíždění.",
        verify: (cmd) => {
            if (cmd.g40) return { success: true, msg: "Korekce zrušena. Připraven k odskoku." };
            return { success: false, msg: "ALARM: Neuvolněna korekce nástroje! Přikaž G40.", lifeLoss: false };
        }
    },
    {
        story: "Kontura se uvolnila.",
        tech: "ÚLOHA: Udělej odskočení v řezu lineárně o 1 mm v délce od materiálu (na X-0.8 Z1).",
        fact: "💡 [NC FAKT]: Malé odskočení brání vydření stopy od návratu po povrchu obrobku.",
        verify: (cmd) => {
            if (cmd.g1 && cmd.x === -0.8 && cmd.z === 1) return { success: true, msg: "Lehký bezpečnostní odskok." };
            return { success: false, msg: "ALARM: Chybné parametry pro odskočení.", lifeLoss: false };
        }
    },
    {
        story: "Nástroj trčí ve volném prostoru mimo obrobek.",
        tech: "ÚLOHA: Zrychli na bezpečnostní únikový perimetr. Zajeď do vyčkávacího bodu X32 a vzájemně Z1 a potvrď chlazení (M8).",
        fact: "💡 [NC FAKT]: Optimalizovaný nájezd v bezpečném koridoru minimalizuje tření kuličkových šroubů a prodlužuje jejich životnost.",
        verify: (cmd) => {
            if (cmd.g0 && cmd.x === 32 && cmd.z === 1 && cmd.m8) return { success: true, msg: "Nástroj je ve stacionárním bodě." };
            return { success: false, msg: "ALARM: Nedostatečný nájezd před započetím geometrie.", lifeLoss: true };
        }
    },
    {
        story: "FÁZE 1 UKONČENA. SYSTÉM PŘIPRAVEN K DRUHÉ FÁZI. ",
        tech: "ÚLOHA: Aktivuj Cyklus geometrického volání na konturu! Vypiš cyklus s číslem šedesát dva.",
        fact: "💡 [NC FAKT]: CYCLE62 na Sinumeriku slouží jako most mezi strojem a vloženým odděleným geometrickým podprogramem.",
        verify: (cmd) => {
            if (cmd.hasCycle62) return { success: true, msg: "SPOJENÍ POTVRZENO. MÓD KONTURY NABÍHÁ." };
            return { success: false, msg: "ALARM: Systém čeká na CYCLE62.", lifeLoss: false };
        }
    },
    // FÁZE 2: Geometrická abstakce
    {
        story: "AKTIVACE GEOMETRICKÉ ABSTRAKCE. FÁZE 2. (REŽIM NASLEPO MÓD ON). Začíná nultý bod profilu podsestavy.",
        tech: "KROK KONTURY 1: Zadej startovní absolutní obvod X18 s pozicí mimo materiál Z1.",
        fact: "💡 [NC FAKT]: Geometrický popis začíná před materiálem, nikoliv přímo na obrobku.",
        verify: (cmd) => {
            if (cmd.x === 18 && cmd.z === 1 && (!cmd.g0 && !cmd.g1)) return { success: true, msg: "Bod 1 zachycen na síti." };
            // Zde netolerujeme G, protože kontura na sinumeriku může jet bez G v podprogramu, anebo to tolerujeme
            if ((cmd.g1 || cmd.g1 === null || !cmd.g1) && cmd.x === 18 && cmd.z === 1) return { success: true, msg: "Bod 1 zachycen." };
            return { success: false, msg: "[NASLEPO]: Zmetek vytvořen! Souřadnice profilu neodpovídají! Požadováno X18 Z1.", lifeLoss: true };
        }
    },
    {
        story: "Bod 1 leží ve výchozím poli.",
        tech: "KROK KONTURY 2: Najeď přesně na čelo struktury (Z je rovno nule) – udržen průměr.",
        fact: "💡 [NC FAKT]:",
        verify: (cmd) => {
            if ((cmd.x === 18 || cmd.x === null) && cmd.z === 0) return { success: true, msg: "Bod 2 aktivován." };
            return { success: false, msg: "ALARM [NASLEPO]: Průnik bariérou selhal. Kontura se narušila.", lifeLoss: true };
        }
    },
    {
        story: "Stín průměru dopadá na osy.",
        tech: "KROK KONTURY 3: Akce vnoř se do polotovaru do hloubky materiálu na absolutní Z mínus šest.",
        fact: "💡 [NC FAKT]: Posun tvoří dráhu úběru z polotovaru.",
        verify: (cmd) => {
            if ((cmd.x === 18 || cmd.x === null) && cmd.z === -6) return { success: true, msg: "Bod 3 ukotven v Z-6." };
            return { success: false, msg: "ALARM [NASLEPO]: Zmetek! Odchylka.", lifeLoss: true };
        }
    },
    {
        story: "Blížíš se ke stoupání přes rádius.",
        tech: "KROK KONTURY 4: Křivka musí vystoupat až na průměr X26 v hloubce Z-10, přes rádius o poloměru R4. Uveď rotaci proti směru G03, systém ho domyslí interpolátorem.",
        fact: "💡 [NC FAKT]: Sinumerik cyklový profilátor se srovná čistě s adresou R, G kód si dosadí.",
        verify: (cmd) => {
            if (cmd.g3 && cmd.x === 26 && cmd.z === -10 && cmd.r === 4) return { success: true, msg: "Zaoblený rohový křivkový bod zapsán!" };
            return { success: false, msg: "ALARM [NASLEPO]: Výpočet R4 křivky zkolaboval! Hrozí podřez.", lifeLoss: true };
        }
    },
    {
        story: "Elegantní křivka nakreslena do vzduchoprázdna modulu.",
        tech: "KROK KONTURY 5: Natáhni podélnou linii z aktuálního bodu na průměru X26 doposud Z-22.",
        fact: "💡 [NC FAKT]: Lineární dráha stabilizuje teplotu břitu po zatížení z oblouku.",
        verify: (cmd) => {
            if (cmd.x === 26 && cmd.z === -22) return { success: true, msg: "Bod 5 nahrán. Válcová dálnice." };
            return { success: false, msg: "ALARM [NASLEPO]: Nesouhlas se vzorem. Kontroverzní sjezd.", lifeLoss: true };
        }
    },
    {
        story: "Rozrážíš obrysy temnoty.",
        tech: "KROK KONTURY 6: Malý ostrý skok stěnou vzhůru po X až k průměru X28 na stejné délce Z-22.",
        fact: "💡 [NC FAKT]: Strmá stěna je hrubována cyklem odzdola.",
        verify: (cmd) => {
            if (cmd.x === 28 && cmd.z === -22) return { success: true, msg: "Bod 6 přečten. Obrysová srážka potvrzena." };
            return { success: false, msg: "ALARM [NASLEPO]: Školácká chyba stoupání souřadnice chyběla.", lifeLoss: true };
        }
    },
    {
        story: "Dr. Axel ti svírá hruď svou kontrolou tolerance.",
        tech: "KROK KONTURY 7: Pokračuj přímo dál po kontuře z průměru X28 do Z-28.",
        fact: "💡 [NC FAKT]: Absolutní Z rozměry stále klesají, prohlubují labyrint.",
        verify: (cmd) => {
            if (cmd.x === 28 && cmd.z === -28) return { success: true, msg: "Bod 7 úspěšně odesrotián." };
            return { success: false, msg: "ALARM [NASLEPO]: Kódy posuvu nebyly přesné. Mimo toleranci.", lifeLoss: true };
        }
    },
    {
        story: "Poslední obrys. Profil obrobku je definovaný.",
        tech: "KROK KONTURY 8: Konec tvarovací rovnice labyrintu leží na odskočeném obalu válce X32 - délka zůstává na bodě Z-28.",
        fact: "💡 [NC FAKT]: Závěr byl uzamknut na nominální hodnotě hrubování.",
        verify: (cmd) => {
            if (cmd.x === 32 && cmd.z === -28) return { success: true, msg: "Bod 8 zaznamenán. Kontroverzní relace splněna." };
            return { success: false, msg: "ALARM [NASLEPO]: Konečný výběr odskočení do X32 ignorován. Systém hlásí Error.", lifeLoss: true };
        }
    },
    // FÁZE 3: Zpracování drah
    {
        story: "FÁZE 3: OBRÁBĚNÍ. Překonal jsi režim abstakce naslepo! Kód se vrací do hlavního kontextu.",
        tech: "ÚLOHA: Nyní všechny tyto uložené kontury předhoď motoru dráhového CNC stroje – inicializuj cyklus 952. Stroj začne kód přežvykovat.",
        fact: "💡 [NC FAKT]: CYCLE952 je speciální hrubovací makro (Stock removal cycle), které využívá body vložené před ním k bezpečnému a co nejrychlejšímu soustružení vrstev.",
        verify: (cmd) => {
            if (cmd.hasCycle952) return { success: true, msg: "CYKLUS 952 AKTIVNÍ... Stroj se chvěje pod masivním náporem odběru třísek. Kontura letí ocelí!" };
            return { success: false, msg: "ALARM: Požadováno volání cyklu devět pět dva.", lifeLoss: false };
        }
    },
    // FÁZE 4: Dokončovací operace na čisto
    {
        story: "Hrubování dokončeno. Třísková bouře utichla — ale Dr. Axel ještě není spokojen. Povrch drsní hrubými stopami a toleranční pole nebylo dosaženo. Musíš přejít na dokončovací operaci!",
        tech: "ÚLOHA: Rychle!!! odskoč nástrojem do bezpečné parkové polohy X50 Z100 a vypni chlazení kódem M9.",
        fact: "💡 [NC FAKT]: Bezpečná poloha X50 Z100 zajišťuje dostatečný prostor pro výměnu nástroje bez kolize.",
        verify: (cmd) => {
            const hasM9 = /\bM0?9\b/.test(cmd.raw);
            if (cmd.g0 && cmd.x === 50 && cmd.z === 100 && hasM9) return { success: true, msg: "Nástroj bezpečně zaparkován. Chlazení deaktivováno." };
            return { success: false, msg: "ALARM: Zadej G0 X50 Z100 M9 pro přejezd do bezpečné polohy.", lifeLoss: true };
        }
    },
    {
        story: "Výměnná ruka robota svižně vymění soustružnický nástroj za kopírovací VBD. Dokončovací fáze začíná.",
        tech: "ÚLOHA: Aktivuj dokončovací nástroj T jménem KOPIROVACI, nastav otáčky S1500, posuv F0.1 a spusť vřeteno M3.",
        fact: "💡 [NC FAKT]: Dokončovací operace vyžaduje vyšší otáčky a nižší posuv než hrubování — hladký povrch závisí na tloušťce třísky.",
        verify: (cmd) => {
            const hasToolKopirovaci = cmd.raw.includes('KOPIROVACI');
            if (hasToolKopirovaci && cmd.s === 1500 && cmd.f === 0.1 && cmd.m3) return { success: true, msg: "[TECH. DATA DOKONČOVÁNÍ]: Přijato. Kopírovací nástroj v rotaci." };
            return { success: false, msg: "ALARM: Technologická data nesouhlasí. Zadej T=\"KOPIROVACI\" S1500 F0.1 M3.", lifeLoss: false };
        }
    },
    {
        story: "Dokončovací břit visí těsně nad povrchem obrobku. Moment pravdy se blíží.",
        tech: "ÚLOHA: Přejdi rychloposuvem G0 na průměr X32 a pozici Z1, zároveň spusť chlazení M8.",
        fact: "💡 [NC FAKT]: Před dokončovacím záběrem najedeme těsně k materiálu — Z1 je standardní bezpečná vzdálenost před čelem a X32 je 1mm nad průměrem polotovaru.",
        verify: (cmd) => {
            if (cmd.g0 && cmd.x === 32 && cmd.z === 1 && cmd.m8) return { success: true, msg: "Dokončovací nástroj vyčkává na X32 Z1. Chlazení aktivováno." };
            return { success: false, msg: "ALARM: Chybí G0 X32 Z1 M8 pro nájezd k obrobku.", lifeLoss: true };
        }
    },
    {
        story: "Geometrická kontura je stále uložena v paměti ŘS... Systém čeká na její opětovné zavolání.",
        tech: "ÚLOHA: Znovu zavolej geometrický podprogram kontury — zadej CYCLE62 pro obnovení profilové reference.",
        fact: "💡 [NC FAKT]: CYCLE62 lze volat opakovaně pro každý obráběcí průchod — hrubování i dokončování sdílejí stejný konturový podprogram.",
        verify: (cmd) => {
            if (cmd.hasCycle62) return { success: true, msg: "KONTURA ZNOVU NAČTENA. ŘS synchronizuje profil s dokončovacím nástrojem." };
            return { success: false, msg: "ALARM: Systém čeká na CYCLE62 pro obnovení kontury.", lifeLoss: false };
        }
    },
    {
        story: "Profil ožil v paměti procesoru. Kopírovací nástroj se rozeběhl po kontuře jako světlo po ostří.",
        tech: "ÚLOHA: Spusť podélné obrobení na čisto — zavolej CYCLE952 pro finální průchod po kontuře.",
        fact: "💡 [NC FAKT]: Druhé volání CYCLE952 po hrubovacím nástroji provede jediný finální průchod přesně po kontuře — bez zbytkového materiálu.",
        verify: (cmd) => {
            if (cmd.hasCycle952) return { success: true, msg: "CYCLE952 — DOKONČOVACÍ PRŮCHOD AKTIVNÍ. Povrch se leští na zrcadlo!" };
            return { success: false, msg: "ALARM: Požadováno volání CYCLE952 pro dokončovací průchod.", lifeLoss: false };
        }
    },
    {
        story: "Třpytivý povrch se zaleskl pod chladicí clonou. Dr. Axel poprvé přikývl — Ra je v toleranci!",
        tech: "ÚLOHA: Rychle!!! dokonči fázi — odskoč do bezpečné parkovací polohy X50 Z100 a vypni chlazení M9.",
        fact: "💡 [NC FAKT]: Závěrečný odjezd do bezpečné polohy ukončuje každou technologickou fázi a připravuje stroj na další krok nebo výměnu polotovaru.",
        verify: (cmd) => {
            const hasM9 = /\bM0?9\b/.test(cmd.raw);
            if (cmd.g0 && cmd.x === 50 && cmd.z === 100 && hasM9) return { success: true, msg: "FÁZE 4 DOKONČENA. Bezpečná poloha dosažena. Chlazení vypnuto." };
            return { success: false, msg: "ALARM: Zadej G0 X50 Z100 M9 pro závěrečný odjezd z fáze.", lifeLoss: true };
        }
    },
    // FÁZE 5: Zápich
    {
        story: "FÁZE 5: ZÁPICH. Obrobek má definovaný vnější profil — ale inženýrský výkres vyžaduje drážku pro pojistný kroužek. Dr. Axel ukazuje na Z-12. Čas pro zapichovací nůž!",
        tech: "ÚLOHA: Vyměň nástroj za T=\"ZAPICHOVÁK 2\", nastav otáčky S800, posuv F0.1 a spusť vřeteno M3.",
        fact: "💡 [NC FAKT]: Zapichovací nůž pracuje s nízkými otáčkami a posuvem — radiální záběr do materiálu je náročnější než podélné soustružení.",
        verify: (cmd) => {
            const hasZapichovak = cmd.raw.includes('ZAPICHOVÁK') || cmd.raw.includes('ZAPICHOVAK');
            if (hasZapichovak && cmd.s === 800 && cmd.f === 0.1 && cmd.m3) return { success: true, msg: "[TECH. DATA ZÁPICHU]: Přijato. Zapichovací nůž v rotaci." };
            return { success: false, msg: "ALARM: Technologická data nesouhlasí. Zadej T=\"ZAPICHOVÁK 2\" S800 F0.1 M3.", lifeLoss: false };
        }
    },
    {
        story: "Tupý klín zapichovacího nože svítí pod reflektory. Nejprve bezpečný nájezd před čelem obrobku.",
        tech: "ÚLOHA: Najeď rychloposuvem G0 na průměr X32 a před čelo Z1, zároveň spusť chlazení M8.",
        fact: "💡 [NC FAKT]: Nájezd před čelo Z1 zajistí, že zapichovací nůž přijíždí k obrobku z bezpečné vzdálenosti a nehrozí kolize s čelem.",
        verify: (cmd) => {
            if (cmd.g0 && cmd.x === 32 && cmd.z === 1 && cmd.m8) return { success: true, msg: "Zapichovací nůž bezpečně před čelem. Chlazení aktivováno." };
            return { success: false, msg: "ALARM: Chybí G0 X32 Z1 M8 pro bezpečný nájezd před čelo.", lifeLoss: true };
        }
    },
    {
        story: "Nůž klouzá podél osy Z souběžně s povrchem válce — a míří přesně na souřadnici zápichu.",
        tech: "ÚLOHA: Přesuň nástroj rychloposuvem G0 na pozici X32 Z-12 — přesně nad místo zápichu.",
        fact: "💡 [NC FAKT]: Přejezd podél povrchu na stejném průměru X32 zajistí, že nůž neprojede materiálem — pohybujeme se pouze v ose Z.",
        verify: (cmd) => {
            if (cmd.g0 && cmd.x === 32 && cmd.z === -12) return { success: true, msg: "Zapichovací nůž nad místem zápichu X32 Z-12. Připraveno ke vstupu!" };
            return { success: false, msg: "ALARM: Chybí G0 X32 Z-12 pro najetí na pozici zápichu.", lifeLoss: true };
        }
    },
    {
        story: "Systém detekuje polotovar. Zapichovací nůž se třese nad drážkou jako přesný chirurgický nástroj.",
        tech: "ÚLOHA: Spusť zapichovací cyklus — zavolej CYCLE930 pro vyvolání automatického zápichu.",
        fact: "💡 [NC FAKT]: CYCLE930 (Undercut) je Sinumerik cyklus pro vytvoření zápichu — automaticky řídí hloubku, šířku a zaoblení drážky podle parametrů zadaných v předchozí definici cyklu.",
        verify: (cmd) => {
            if (cmd.hasCycle930) return { success: true, msg: "CYCLE930 AKTIVNÍ — Drážka se řeže! Ocelový prach letí do chlazení." };
            return { success: false, msg: "ALARM: Systém čeká na CYCLE930 pro provedení zápichu.", lifeLoss: false };
        }
    },
    {
        story: "Drážka je přesně vyřezána. Pojistný kroužek bude sedět jako ulitý. Zapichovací nůž odjíždí zpět.",
        tech: "ÚLOHA: Odskoč rychloposuvem G0 do bezpečné parkovací polohy X50 Z100 a vypni chlazení M9.",
        fact: "💡 [NC FAKT]: Po dokončení zápichu se vždy odjíždí do bezpečné polohy — zapichovací nůž je křehký a nesmí zůstat v blízkosti rotujícího obrobku.",
        verify: (cmd) => {
            const hasM9 = /\bM0?9\b/.test(cmd.raw);
            if (cmd.g0 && cmd.x === 50 && cmd.z === 100 && hasM9) return { success: true, msg: "FÁZE 5 DOKONČENA. Zápich vytvořen. Bezpečná poloha dosažena." };
            return { success: false, msg: "ALARM: Zadej G0 X50 Z100 M9 pro odjezd po zápichu.", lifeLoss: true };
        }
    },
    // FÁZE 6: Upíchnutí
    {
        story: "FÁZE 6: FINÁL. Labyrint je hotov, drážky vyřezány. Teď musíme oddělit toto mistrovské dílo od zbytku surové tyče. Dr. Axel sleduje tvůj poslední řez.",
        tech: "ÚLOHA: Vyměň nástroj za T=\"UPICHOVAK 3.1\", nastav otáčky S800, posuv F0.1 a spusť vřeteno M3.",
        fact: "💡 [NC FAKT]: Upichovací nůž (Parting tool) je určen k oddělení hotového dílu. Vyžaduje stabilitu a přesné technologické parametry.",
        verify: (cmd) => {
            const hasUpichovak = cmd.raw.includes('UPICHOVAK');
            if (hasUpichovak && cmd.s === 800 && cmd.f === 0.1 && cmd.m3) return { success: true, msg: "[TECH. DATA UPÍCHNUTÍ]: Přijato. Upichovací nůž v rotaci." };
            return { success: false, msg: "ALARM: Technologická data nesouhlasí. Zadej T=\"UPICHOVAK 3.1\" S800 F0.1 M3.", lifeLoss: false };
        }
    },
    {
        story: "Nůž je připraven. Nejprve bezpečný nájezd nad průměr polotovaru.",
        tech: "ÚLOHA: Najeď rychloposuvem G0 na průměr X32 a před čelo Z1, spusť chlazení M8.",
        fact: "💡 [NC FAKT]: Opětovný nájezd na bezpečnou pozici X32 Z1 před jakoukoli novou operací je základem bezpečného NC programování.",
        verify: (cmd) => {
            if (cmd.g0 && cmd.x === 32 && cmd.z === 1 && cmd.m8) return { success: true, msg: "Upichovák v pohotovosti nad čelem." };
            return { success: false, msg: "ALARM: Chybí G0 X32 Z1 M8.", lifeLoss: true };
        }
    },
    {
        story: "Nůž se přesouvá na definitivní místo úpichu na zadní straně součásti.",
        tech: "ÚLOHA: Přesuň nástroj rychloposuvem G0 na pozici X32 Z-27 — přesně na místo úpichu.",
        fact: "💡 [NC FAKT]: Souřadnice Z-27 určuje celkovou délku součásti, která bude po úpichu oddělena.",
        verify: (cmd) => {
            if (cmd.g0 && cmd.x === 32 && cmd.z === -27) return { success: true, msg: "Upichovák na pozici Z-27." };
            return { success: false, msg: "ALARM: Chybí G0 X32 Z-27.", lifeLoss: true };
        }
    },
    {
        story: "Konec simulace na dohled. Poslední ocelová pouta budou přerušena.",
        tech: "ÚLOHA: Spusť upichovací cyklus — zavolej CYCLE92.",
        fact: "💡 [NC FAKT]: CYCLE92 je standardní Sinumerik cyklus pro upíchnutí součásti, který řeší i bezpečné snížení otáček před doříznutím.",
        verify: (cmd) => {
            if (cmd.hasCycle92) return { success: true, msg: "CYCLE92 AKTIVNÍ... Součástka se uvolňuje a dopadá do lapače!" };
            return { success: false, msg: "ALARM: Systém čeká na CYCLE92.", lifeLoss: false };
        }
    },
    {
        story: "Mise splněna. Obrobek je na svobodě.",
        tech: "ÚLOHA: Odskoč naposledy do bezpečné polohy X50 Z100 a vypni chlazení M9.",
        fact: "💡 [NC FAKT]: Závěrečný odjezd uvolňuje pracovní prostor stroje pro manipulaci.",
        verify: (cmd) => {
            const hasM9 = /\bM0?9\b/.test(cmd.raw);
            if (cmd.g0 && cmd.x === 50 && cmd.z === 100 && hasM9) return { success: true, msg: "FÁZE 6 DOKONČENA. Stroj je v bezpečí." };
            return { success: false, msg: "ALARM: Zadej G0 X50 Z100 M9.", lifeLoss: true };
        }
    },
    // Závěr programu
    {
        story: "Hromotluk obrábění zmlkl definitivně. Obrobek se třpytí pod studenými světly — surový ocelový útvar Dr. Axela se stal přesností samou. Zbývá jediný kód.",
        tech: "ÚLOHA: Uzavři NC program! Odešli závěrečný M kód o hodnotě třicet — konec programu.",
        fact: "💡 [NC FAKT]: M30 zajistí reset programového ukazatele na začátek, vypne vřeteno a ukončí komunikaci ŘS s programem.",
        verify: (cmd) => {
            if (cmd.m30) return { success: true, msg: "DEAKTIVACE VŘETENE... PROGRAM RESETOVÁN. MISE SPLNĚNA." };
            return { success: false, msg: "ALARM: Jediný povolený příkaz je závěr programu M30.", lifeLoss: false };
        }
    }
];

// DOM a Canvas Logika pro Master Program update.

const elHistory = document.getElementById('history-log');
const elInput = document.getElementById('command-input');
const elSubmit = document.getElementById('btn-submit');
const canvas = document.getElementById('toolpath-map');
const ctx = canvas.getContext('2d');

const uiScore = document.getElementById('ui-score');
const uiCoords = document.getElementById('ui-coords');
const uiLives = document.getElementById('ui-lives');
const elBtnMusic = document.getElementById('btn-music');
const elBgMusic = document.getElementById('bg-music');
const elMusicSelector = document.getElementById('music-selector');

function updateUI() {
    uiScore.innerText = gameState.score.toString().padStart(4, '0');
    // Compute current real coords from block history
    let curX = "??"; let curZ = "??";
    for (let b of gameState.blocks) {
        if (b.x !== null) curX = b.x;
        if (b.z !== null) curZ = b.z;
    }
    uiCoords.innerText = `X${curX} Z${curZ}`;
    let hearts = "";
    for (let i = 0; i < 3; i++) hearts += (i < gameState.lives) ? "❤" : "♡";
    uiLives.innerText = hearts;
}

// ----- CANVAS MAP DRAWING -----
function drawGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cw = canvas.width; const ch = canvas.height;

    // Grid Lines
    ctx.strokeStyle = "rgba(56, 189, 248, 0.1)";
    ctx.lineWidth = 1;
    for (let i = 0; i < cw; i += 20) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, ch); ctx.stroke(); }
    for (let i = 0; i < ch; i += 20) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(cw, i); ctx.stroke(); }

    // Osa Z
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath(); ctx.moveTo(0, 200); ctx.lineTo(cw, 200); ctx.stroke();
    // Osa X
    ctx.beginPath(); ctx.moveTo(320, 0); ctx.lineTo(320, ch); ctx.stroke();
}

function mapCoords(xReal, zReal) {
    const scale = 3.0; // scale up
    const cx = 320 + (zReal * scale);
    const cz = 200 - ((xReal / 2) * scale); // X průměr / 2 je poloměr nad osou
    return { cx, cz };
}

function drawToolpath() {
    drawGrid();
    let curX = 32.0; let curZ = 5.0; // Fiktivní start point reference

    // Vykreslíme to co student poslal do paměti jako reálné trasování (Fáze 1 a 2)
    for (let b of gameState.blocks) {
        let isMovement = b.g0 || b.g1 || b.g2 || b.g3 || (b.x !== null || b.z !== null);
        if (!isMovement) continue;

        let targetX = b.x !== null ? b.x : curX;
        let targetZ = b.z !== null ? b.z : curZ;

        let { cx: tX, cz: tZ } = mapCoords(targetX, targetZ);
        let { cx: sX, cz: sZ } = mapCoords(curX, curZ);

        ctx.beginPath();
        if (b.g0) {
            ctx.strokeStyle = "#ef4444";
            ctx.setLineDash([5, 5]);
        } else {
            ctx.strokeStyle = "#38bdf8";
            ctx.setLineDash([]);
        }

        ctx.lineWidth = 2;
        ctx.moveTo(sX, sZ);
        
        if (b.g2 || b.g3) {
            let dx = tX - sX;
            let dy = tZ - sZ;
            let dist = Math.hypot(dx, dy);
            let rScale = b.r ? b.r * 3.0 : dist / 2;

            if (dist > 0) {
                if (rScale < dist / 2) rScale = dist / 2;
                
                let midX = (sX + tX) / 2;
                let midY = (sZ + tZ) / 2;
                let h = Math.sqrt(rScale * rScale - (dist / 2) * (dist / 2));
                
                let nx = -dy / dist;
                let ny = dx / dist;
                
                let sign = b.g3 ? -1 : 1;
                let cX = midX + sign * h * nx;
                let cY = midY + sign * h * ny;
                
                let startAngle = Math.atan2(sZ - cY, sX - cX);
                let endAngle = Math.atan2(tZ - cY, tX - cX);
                
                ctx.arc(cX, cY, rScale, startAngle, endAngle, b.g3 ? true : false);
            } else {
                ctx.lineTo(tX, tZ);
            }
        } else {
            ctx.lineTo(tX, tZ);
        }
        
        ctx.stroke();

        curX = targetX;
        curZ = targetZ;
    }

    // Draw current tool tip
    const { cx: endX, cz: endZ } = mapCoords(curX, curZ);
    ctx.beginPath();
    ctx.arc(endX, endZ, 4, 0, 2 * Math.PI);
    ctx.fillStyle = "yellow";
    ctx.fill();
}
// ------------------------------

async function typeWriter(element, text, speed = 8) {
    gameState.isTyping = true;
    elInput.disabled = true;
    elSubmit.disabled = true;
    let i = 0;
    return new Promise(resolve => {
        element.classList.add('typewriter-text');
        function type() {
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                i++;
                elHistory.scrollTop = elHistory.scrollHeight;
                setTimeout(type, speed);
            } else {
                element.classList.remove('typewriter-text');
                gameState.isTyping = false;
                elInput.disabled = false;
                elSubmit.disabled = false;
                elInput.focus();
                resolve();
            }
        }
        type();
    });
}

function formatWithHighlights(txt) {
    return txt.replace(/(N\d+)/g, '<span class="txt-green">$1</span>')
        .replace(/(G\d+)/g, '<span class="txt-green">$1</span>')
        .replace(/(X-?\d+\.?\d*)/g, '<strong class="txt-green">$1</strong>')
        .replace(/(Z-?\d+\.?\d*)/g, '<strong class="txt-green">$1</strong>');
}

async function printLog(text, className, typing = false) {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${className}`;
    elHistory.appendChild(logEntry);

    if (typing) {
        await typeWriter(logEntry, text);
    } else {
        logEntry.innerHTML = formatWithHighlights(text);
        elHistory.scrollTop = elHistory.scrollHeight;
    }
}

async function startStep() {
    if (gameState.step < STEPS.length) {
        const s = STEPS[gameState.step];
        await printLog(s.story, "log-story", true);
        await new Promise(r => setTimeout(r, 200));
        await printLog(s.tech, "log-tech", true);
        await new Promise(r => setTimeout(r, 200));
        await printLog(s.fact, "log-fact", true);
        await new Promise(r => setTimeout(r, 200));

        // Změna nápovědy v módu naslepo vs fázi práce!
        document.getElementById('n-prefix').innerText = `N${(gameState.step + 1) * 10}`;
        if (s.tech.includes("KROK KONTURY")) {
            await printLog("GEOMETRICKÁ ABSTRAKCE: Zadejte instrukci tvaru (X... Z...):", "log-ai", true);
        } else {
            await printLog("SYNCHRONIZACE ŘS: Doplň instrukce dál po bloku:", "log-ai", true);
        }
    } else {
        await printLog("PROGRAM ZACHRÁNĚN, ÚROVEŇ ZCELA OVLÁDNUTA. OPERÁTORE, DĚKUJEME.", "log-success", true);
        elInput.disabled = true;
        elSubmit.disabled = true;
        document.getElementById('victory-banner').style.display = 'flex';
    }
}

async function startRescueProtocol() {
    rescueMode.active = true;
    rescueMode.currentQuestion = 0;

    let shuffledPool = shuffleArray(QUESTION_POOL);
    let selected = shuffledPool.slice(0, 6);

    rescueMode.questions = selected.map((qObj, index) => {
        let opts = [
            { text: qObj.options[0], isCorrect: true },
            { text: qObj.options[1], isCorrect: false },
            { text: qObj.options[2], isCorrect: false }
        ];
        opts = shuffleArray(opts);

        let correctLetter = "";
        if (opts[0].isCorrect) correctLetter = "A";
        else if (opts[1].isCorrect) correctLetter = "B";
        else correctLetter = "C";

        let textStr = `[RESTART SEKTOR ${index + 1}/6]\n${qObj.q}\nA) ${opts[0].text}\nB) ${opts[1].text}\nC) ${opts[2].text}\nZadej volbu (A/B/C):`;

        return { text: textStr, correct: correctLetter };
    });

    document.getElementById('n-prefix').style.display = 'none';
    elInput.disabled = true;
    elSubmit.disabled = true;

    await printLog("KRITICKÝ STAV: Systémová integrita na nule. Dr. Axel aktivoval bezpečnostní protokol 'Školitel'. Pokud chceš zachránit rozdělaný kus a neskončit v šrotu, musíš projít kompletní rekvalifikační prověrkou (6/6). Jedna chyba a tvá kariéra seřizovače končí.", "log-error", true);

    document.getElementById('terminal-test').style.display = 'flex';
    askRescueQuestion();
}

async function askRescueQuestion() {
    let q = rescueMode.questions[rescueMode.currentQuestion];
    document.getElementById('terminal-test-text').innerText = q.text;
    const testInput = document.getElementById('terminal-test-input');
    testInput.value = "";
    testInput.focus();
}

function restartGame() {
    gameState.lives = 3; gameState.score = 0; gameState.step = 0; gameState.blocks = [];
    elHistory.innerHTML = ""; updateUI(); drawToolpath();
    elInput.disabled = false; elSubmit.disabled = false;
    document.getElementById('n-prefix').style.display = 'inline';
    document.getElementById('terminal-test').style.display = 'none';
    startStep();
}

async function applyRescueCommand() {
    if (!rescueMode.active) return;
    const testInput = document.getElementById('terminal-test-input');
    const val = testInput.value.trim().toUpperCase();
    if (!val) return;

    testInput.value = "";
    let q = rescueMode.questions[rescueMode.currentQuestion];

    if (val === q.correct) {
        rescueMode.currentQuestion++;
        await printLog(`Zadáno [${val}] -> SPRÁVNĚ.`, "log-success", true);
        if (rescueMode.currentQuestion >= rescueMode.questions.length) {
            rescueMode.active = false;
            gameState.lives = 1;
            updateUI();
            document.getElementById('terminal-test').style.display = 'none';
            await printLog("PROVĚRKA ÚSPĚŠNÁ. Dr. Axel uznává tvé teoretické kvality. Systém restartován, vracím 1 život. Pokračuj v kódování tam, kde jsi skončil.", "log-success", true);
            document.getElementById('n-prefix').style.display = 'inline';
            document.getElementById('n-prefix').innerText = `N${(gameState.step + 1) * 10}`;
            elInput.disabled = false;
            elSubmit.disabled = false;
            elInput.focus();
        } else {
            askRescueQuestion();
        }
    } else {
        rescueMode.active = false;
        document.getElementById('terminal-test').style.display = 'none';
        await printLog(`Zadáno [${val}] -> CHYBA!`, "log-error", true);
        let jokes = [
            "GAME OVER: Z tvého čepu zbyla jen hromada špon a Dr. Axel tě právě přeřadil k ručnímu zametání haly. Bez koštěte.",
            "KOLIZE POTVRZENA: Vřeteno právě provedlo neplánovanou demontáž stroje. Gratuluji, stal ses nejdražším studentem v historii školy.",
            "FATAL ERROR: Tvůj kód má víc děr než ementál. Dr. Axel tě posílá zpět do prvního ročníku učit se brousit důlčíky.",
            "KONEC HRY: Stroj právě spáchal technologickou sebevraždu, aby se vyhnul tvému programování. Jdi raději studovat poezii."
        ];
        let msg = jokes[Math.floor(Math.random() * jokes.length)];
        await printLog(msg, "log-error", true);

        document.getElementById('gameover-text').innerText = msg;
        document.getElementById('gameover-banner').style.display = 'flex';
    }
}

document.getElementById('terminal-test-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        applyRescueCommand();
    }
});

async function applyCommand() {
    if (gameState.isTyping) return;
    const val = elInput.value.trim().toUpperCase();
    if (!val) return;

    // Funkce Hint (klávesa X)
    if (val === 'X') {
        const answer = CORRECT_ANSWERS[gameState.step];
        if (answer !== undefined) {
            elInput.value = answer;
        }
        return;
    }

    // Funkce Skok na řádek Nxxx
    const jumpMatch = val.match(/^N(\d+)$/);
    if (jumpMatch) {
        let nValue = parseInt(jumpMatch[1], 10);
        let targetStep = (nValue / 10) - 1;

        if (targetStep >= 0 && targetStep < STEPS.length) {
            elInput.value = "";
            await printLog(`> SKOK DO BLOKU N${nValue}`, "log-user");
            
            gameState.step = targetStep;
            gameState.blocks = [];
            // Doplnění historie drah pro vizualizaci plátna, jako by to uživatel prošel
            for (let i = 0; i < targetStep; i++) {
                let prevCmd = CORRECT_ANSWERS[i];
                let cmdWithN = prevCmd.includes('N') ? prevCmd : `N${(i + 1) * 10} ${prevCmd}`;
                gameState.blocks.push(parseCommand(cmdWithN));
            }
            
            drawToolpath();
            updateUI();
            
            await printLog(`[SYSTÉM]: Skok proveden. Systém úspěšně inicializován do stavu N${nValue}.`, "log-success", true);
            startStep();
            return;
        }
    }

    elInput.value = "";

    let currentNStr = `N${(gameState.step + 1) * 10}`;
    let valToParse = val.toUpperCase().includes('N') ? val : `${currentNStr} ${val}`;

    await printLog(`> ${valToParse}`, "log-user");

    const cmd = parseCommand(valToParse);

    // Blok N už systém přidá sám (případě uživatel), není tedy striktně testováno null.

    const currentLogic = STEPS[gameState.step];
    const result = currentLogic.verify(cmd);

    if (result.success) {
        gameState.blocks.push(cmd);
        drawToolpath();

        gameState.score += 25;
        updateUI();

        await printLog(`[VERIFIKOVÁNO]: ${result.msg}`, "log-success", true);
        gameState.step++;

        setTimeout(() => startStep(), 1200);
    } else {
        gameState.score = Math.max(0, gameState.score - 10);
        gameState.lives--;
        updateUI();

        await printLog(`ALARM: Kolize nebo syntaktická chyba! Systém poškozen. [Důvod: ${result.msg}] (-10 bodů)`, "log-error", true);

        if (gameState.lives <= 0) {
            startRescueProtocol();
        }
    }
}

// Správné odpovědi pro každý krok (index odpovídá gameState.step)
const CORRECT_ANSWERS = [
    "WORKPIECE",                      // 0: FÁZE 1 - polotovar
    "G90 G54",                        // 1: absolutní + nulový bod
    "T=\"HRUBOVACI\" S1200 F0.2 M3",   // 2: tech. data hrubování
    "G0 X32 Z0 M3 M8",               // 3: nájezd k čelu
    "G41",                            // 4: korekce vlevo
    "G1 X-0.8 Z0",                   // 5: zarovnání čela
    "G40",                            // 6: zrušení korekce
    "G1 X-0.8 Z1",                   // 7: odskočení
    "G0 X32 Z1 M8",                  // 8: nájezd před cyklus
    "CYCLE62",                        // 9: volání kontury
    "X18 Z1",                         // 10: FÁZE 2 - bod 1
    "Z0",                             // 11: bod 2
    "Z-6",                            // 12: bod 3
    "G03 X26 Z-10 R4",                // 13: bod 4 - rádius
    "X26 Z-22",                       // 14: bod 5
    "X28 Z-22",                       // 15: bod 6
    "X28 Z-28",                       // 16: bod 7
    "X32 Z-28",                       // 17: bod 8
    "CYCLE952",                       // 18: FÁZE 3 - hrubování
    "G0 X50 Z100 M9",                // 19: FÁZE 4 - odjezd do bezpečna
    "T=\"KOPIROVACI\" S1500 F0.1 M3", // 20: dokončovací nástroj
    "G0 X32 Z1 M8",                  // 21: nájezd dokončování
    "CYCLE62",                        // 22: volání kontury podruhé
    "CYCLE952",                       // 23: dokončovací průchod
    "G0 X50 Z100 M9",                // 24: odjezd po dokončování
    "T=\"ZAPICHOVÁK 2\" S800 F0.1 M3",// 25: FÁZE 5 - zapichovák
    "G0 X32 Z1 M8",                  // 26: nájezd před čelo
    "G0 X32 Z-12",                   // 27: nájezd na pozici zápichu
    "CYCLE930",                       // 28: zapichovací cyklus
    "G0 X50 Z100 M9",                // 29: odjezd po zápichu
    "T=\"UPICHOVAK 3.1\" S800 F0.1 M3", // 30: FÁZE 6 - upichovák
    "G0 X32 Z1 M8",                  // 31: nájezd před čelo
    "G0 X32 Z-27",                   // 32: nájezd na pozici úpichu
    "CYCLE92",                        // 33: upichovací cyklus
    "G0 X50 Z100 M9",                // 34: odjezd po úpichu
    "M30"                             // 35: konec programu
];

// Generování PDF s pevným zadáním programu
function downloadPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("Chyba při načítání PDF knihovny.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    function formatStr(str) {
        return str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/–/g, '-') : "";
    }

    doc.setFont("courier", "bold");
    doc.setFontSize(16);
    doc.text(formatStr("MASTER PROGRAM - VYSLEDEK SIMULACE"), 20, 20);
    
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    doc.text(formatStr("Kompletni a spravne vygenerovany NC kod:"), 20, 30);
    
    const pdfData = [
        { c: 'N10 WORKPIECE', e: 'definice velikosti obrobku' },
        { c: 'N20 G90 G54', e: 'absolutni odmerovani, aktivace nuloveho bodu obrobku W' },
        { c: '', e: '' },
        { h: 'ZAROVNANI CELA A HRUBOVANI OBRYSU' },
        { c: 'N30 T="HRUBOVACI" S1200 F0.2 M3', e: 'volba nastroje, otacky, posuv, vreteno doprava' },
        { c: 'N40 G0 X32 Z0 M8', e: 'rychloposuvem na vychozi bod pred zarovnanim cela, aktivace chlazeni' },
        { c: 'N50 G41', e: 'aktivace polomerovych korekci vlevo od obrysu' },
        { c: 'N60 G1 X-0.8 Z0', e: 'zarovnani cela pracovnim posuvem' },
        { c: 'N70 G40', e: 'deaktivace korekci' },
        { c: 'N80 G1 X-0.8 Z1', e: 'pracovnim posuvem 1 mm od cela' },
        { c: 'N90 G0 X32 Z1 (M8)', e: 'rychloposuvem na vychozi bod pred hrubovanim obrysu' },
        { c: 'N100 CYCLE62 (OBRYS)', e: 'volani kontury' },
        { c: 'N190 CYCLE952', e: 'konturovy odber trisky (nahrubo)' },
        { c: 'N200 G0 X50 Z100 M9', e: 'odjezd do bezpecne vzdalenosti pro vymenu nastroje' },
        { c: '', e: '' },
        { h: 'OBRYS NACISTO' },
        { c: 'N210 T="KOPIROVACI" S1500 F0.1 M3', e: 'volba nastroje, otacky, posuv, vreteno doprava' },
        { c: 'N220 G0 X32 Z1 M8', e: 'najezd do vychozi polohy pred obrobenim nacisto' },
        { c: 'N230 CYCLE62 (OBRYS)', e: 'volani kontury' },
        { c: 'N240 CYCLE952', e: 'konturovy odber trisky (nacisto)' },
        { c: 'N250 G0 X50 Z100 M9', e: 'odjezd do bezpecne vzdalenosti pro vymenu nastroje' },
        { c: '', e: '' },
        { h: 'ZAPICH' },
        { c: 'N260 T="ZAPICHOVAK 2" S800 F0.1 M3', e: 'volba nastroje, otacky, posuv, vreteno doprava' },
        { c: 'N270 G0 X32 Z1 M8', e: 'najezd do bezpecne polohy pred obrobek' },
        { c: 'N280 G0 X32 Z-12', e: 'najezd do mista zapichu' },
        { c: 'N290 CYCLE930', e: 'volba zapichovaciho cyklu' },
        { c: 'N300 G0 X50 Z100 M9', e: 'odjezd do bezpecne vzdalenosti pro vymenu nastroje' },
        { c: '', e: '' },
        { h: 'UPICH' },
        { c: 'N310 T="UPICHOVAK 3.1" S800 F0.1 M3', e: 'volba nastroje, otacky, posuv, vreteno doprava' },
        { c: 'N320 G0 X32 Z1 M8', e: 'najezd do bezpecne polohy pred obrobek' },
        { c: 'N330 G0 X32 Z-27', e: 'najezd do mista upichu' },
        { c: 'N340 CYCLE92', e: 'volba upichovaciho cyklu' },
        { c: 'N350 G0 X50 Z100 M9', e: 'odjezd do bezpecne vzdalenosti pro vymenu nastroje' },
        { c: 'N360 M30', e: 'konec programu s navratem na zacatek' },
        { c: '', e: '' },
        { h: 'PODPROGRAM' },
        { c: 'E_LAB_A_OBRYS', e: '' },
        { c: 'G1 X18 Z1', e: '' },
        { c: 'G1 Z0', e: '' },
        { c: 'G1 Z-6', e: '' },
        { c: 'G03 X26 Z-10 R4', e: '' },
        { c: 'G1 X26 Z-22', e: '' },
        { c: 'G1 X28 Z-22', e: '' },
        { c: 'G1 X28 Z-28', e: '' },
        { c: 'G1 X32 Z-28', e: '' },
        { c: 'E_LAB_E_OBRYS', e: '' }
    ];

    let y = 40;
    
    for (let row of pdfData) {
        if (y > 275) {
            doc.addPage();
            y = 20;
        }

        if (row.h) {
            if (row.h === 'PODPROGRAM') {
                doc.addPage();
                y = 20;
            }
            doc.setFont("courier", "bold");
            doc.text("; " + row.h, 20, y);
            y += 6;
        } else if (row.c) {
            let fullLine = row.c + (row.e ? " - " + row.e : "");
            doc.setFont("courier", "normal");
            
            // Highlight the code block as bold for better readability, and normal for explanation
            // Using standard uniform text here just for simplicity, but it's clean and safe
            let wrapped = doc.splitTextToSize(fullLine, 170);
            doc.text(wrapped, 20, y);
            
            y += (wrapped.length * 5) + 1;
        } else {
            y += 4;
        }
    }
    
    doc.save("NC_Program_Axel.pdf");
}

elSubmit.addEventListener('click', applyCommand);
elInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
});
elInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        applyCommand();
    }
});

let musicPlaying = false;

function toggleMusic(forcePlay = false) {
    if (musicPlaying && !forcePlay) {
        elBgMusic.pause();
        elBtnMusic.innerText = "🔇 HUDBA";
        elBtnMusic.style.borderColor = "var(--text-muted)";
        elBtnMusic.style.color = "var(--text-muted)";
        musicPlaying = false;
    } else if (!musicPlaying) {
        elBgMusic.volume = 0.3;
        let playPromise = elBgMusic.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                musicPlaying = true;
                elBtnMusic.innerText = "🔊 HUDBA";
                elBtnMusic.style.borderColor = "var(--accent-cyan)";
                elBtnMusic.style.color = "var(--accent-cyan)";
            }).catch(e => console.log("Prohlížeč odložil autopřehrávání zvuku na první interakci."));
        }
    }
}

elBtnMusic.addEventListener('click', () => toggleMusic(false));

elMusicSelector.addEventListener('change', (e) => {
    const val = e.target.value;
    const wasPlaying = musicPlaying;

    if (val === 'default') {
        elBgMusic.innerHTML = `
        <source src="music.mp3" type="audio/mpeg">
        <source src="https://upload.wikimedia.org/wikipedia/commons/8/87/Drone_2_-_15_mins.ogg" type="audio/ogg">`;
        elBgMusic.removeAttribute('src');
    } else {
        elBgMusic.innerHTML = '';
        elBgMusic.src = val;
    }

    elBgMusic.load();

    // Pokud hudba hrála, znovu ji spustíme s novým zdrojem
    if (wasPlaying) {
        musicPlaying = false; // pro korektní reset v toggleMusic
        toggleMusic(true);
    }
});

// Autoplay handling - zkusí hned
window.addEventListener('load', () => {
    toggleMusic(true);
});

// Záchranný start - pokud prohlížeč zablokuje onload autoplay, spustí se ihned s prvním stisknutím klávesy nebo klikem.
const startAudioOnInteraction = () => {
    if (!musicPlaying) toggleMusic(true);
    document.removeEventListener('click', startAudioOnInteraction);
    document.removeEventListener('keydown', startAudioOnInteraction);
};
document.addEventListener('click', startAudioOnInteraction);
document.addEventListener('keydown', startAudioOnInteraction);

window.onload = () => {
    updateUI();
    drawToolpath();
    startStep();
};
