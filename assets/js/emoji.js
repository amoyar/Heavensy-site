// ============================================
// EMOJI.JS — Picker profesional para Heavensy
// Búsqueda por palabras clave en español
// ============================================

console.log("😊 emoji.js cargado");

// ─── Datos por categoría ──────────────────────────────────────────────────────
const EMOJI_DATA = {
  "😊": ["😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😋","😎","😍","🥰","😘","😗","😙","😚","🙂","🤗","🤩","🤔","🤨","😐","😑","😶","🙄","😏","😣","😥","😮","🤐","😯","😪","😫","🥱","😴","😌","😛","😜","😝","🤤","😒","😓","😔","😕","🙃","🤑","😲","☹️","🙁","😖","😞","😟","😤","😢","😭","😦","😧","😨","😩","🤯","😬","😰","😱","🥵","🥶","😳","🤪","😵","🥴","😠","😡","🤬","😷","🤒","🤕","🤢","🤮","🤧","😇","🥳","🥺","🤠","🤡","🤥","🤫","🤭","🧐","🤓"],
  "👋": ["👋","🤚","🖐","✋","🖖","👌","🤌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦵","🦶","👂","🦻","👃","🧠","🦷","🦴","👀","👁","👅","👄"],
  "❤️": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖","💘","💝","💟","🥰","😍","😘","💏","💑","👨‍👩‍👧","👨‍👩‍👦","👪","🌹","💐","🌺","🌸","🌼","🌻","🌷"],
  "🎉": ["🎉","🎊","🎈","🎁","🎀","🎗","🎟","🎫","🏆","🥇","🥈","🥉","🏅","🎖","🎪","🤹","🎭","🎨","🎬","🎤","🎧","🎼","🎵","🎶","🎹","🥁","🎷","🎺","🎸","🎻","🎲","♟","🎯","🎳","🎮","🎰","🧩","🪀","🪁"],
  "🐶": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🐛","🦋","🐌","🐞","🐜","🕷","🦂","🐢","🐍","🦎","🐙","🦑","🦐","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆","🦓","🐘","🦒","🦘","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🐕","🐈","🐓","🦃","🦚","🦜","🦢","🦩","🕊","🐇","🦝","🦨","🦡","🦦","🦥","🐁","🐀","🐿","🦔"],
  "🍕": ["🍕","🍔","🌮","🌯","🥙","🧆","🥚","🍳","🥘","🍲","🥣","🥗","🍿","🧈","🥫","🍱","🍘","🍙","🍚","🍛","🍜","🍝","🍠","🍢","🧁","🍡","🍧","🍨","🍦","🥧","🍰","🎂","🍮","🍭","🍬","🍫","🍩","🍪","🌰","🥜","🍯","🧃","🥤","🧋","☕","🍵","🫖","🍺","🍻","🥂","🍷","🥃","🍸","🍹","🧉","🍾","🥐","🥖","🫓","🧀","🥞","🧇","🥓","🌭","🥪"],
  "🌍": ["🌍","🌎","🌏","🌐","🗺","🧭","🏔","⛰","🌋","🗻","🏕","🏖","🏜","🏝","🏞","🏟","🏛","🏗","🧱","🏘","🏠","🏡","🏢","🏣","🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯","🏰","💒","🗼","🗽","⛪","🕌","🛕","🕍","⛩","🕋","⛲","⛺","🌁","🌃","🏙","🌄","🌅","🌆","🌇","🌉","🎠","🎡","🎢","💈","🎪"],
  "⚽": ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🏓","🏸","🏒","🏑","🥍","🏏","🥅","⛳","🏹","🎣","🤿","🥊","🥋","🎽","🛹","🛼","🛷","⛸","🥌","🎿","🏆","🥇","🏋️","🤸","⛹️","🤺","🤾","🏌️","🏇","🧘","🏄","🏊","🤽","🚣","🧗","🚵","🚴"],
  "✈️": ["✈️","🚀","🛸","🚁","🛶","⛵","🚤","🛥","🛳","⛴","🚢","🚂","🚃","🚄","🚅","🚆","🚇","🚈","🚉","🚊","🚝","🚞","🚋","🚌","🚍","🚎","🚐","🚑","🚒","🚓","🚔","🚕","🚖","🚗","🚘","🚙","🛻","🚚","🏎","🏍","🛵","🚲","🛴","🛹","🛼","🚦","🚥","🧳","⛽","🚧","⚓"],
  "💡": ["💡","🔦","🕯","🪔","🧯","💰","💴","💵","💶","💷","💸","💳","🪙","💹","📈","📉","📊","📋","📌","📍","📎","🖇","📏","📐","✂️","🗃","🗄","🗑","🔒","🔓","🔑","🗝","🔨","🪓","⛏","⚒","🛠","⚔️","🔫","🏹","🛡","🔧","🪛","🔩","⚙️","🗜","⚖️","🔮","🪄","🧲","🪜","🧰","🔬","🔭","📡","💻","🖥","⌨️","🖱","💾","💿","📀","📱","☎️","📞","📟","📠","🔋","🔌"],
  "💬": ["💬","💭","🗯","💤","💢","💥","💫","💦","💨","🕳","💣","🔈","🔉","🔊","📢","📣","🔔","🔕","🎵","🎶","✅","❌","❓","❗","⚠️","🚫","🔞","💯","🆕","🆒","🆓","🆙","🆗","🆘","🆚","🅰️","🅱️","🅾️","🅿️","🔝","🔛","🔜","🔚","🔙","🔴","🟠","🟡","🟢","🔵","🟣","⚫","⚪","🟤","🔶","🔷","🔸","🔹","🔺","🔻","💠","🔘","🔲","🔳","▪️","▫️","◾","◽","◼️","◻️","⬛","⬜","🟥","🟧","🟨","🟩","🟦","🟪","🟫"]
};

const CAT_LABELS = {
  "😊":"Caras","👋":"Gestos","❤️":"Amor","🎉":"Celebración",
  "🐶":"Animales","🍕":"Comida","🌍":"Lugares","⚽":"Deportes",
  "✈️":"Viajes","💡":"Objetos","💬":"Símbolos"
};

// ─── Mapa de palabras clave en español ────────────────────────────────────────
// Formato: emoji → "kw1 kw2 kw3 ..."
const KW = {
  "😀":"cara feliz contento sonrisa alegre","😁":"sonrisa dientes feliz",
  "😂":"llanto risa carcajada gracioso llorando","🤣":"rodando risa gracioso muerto",
  "😃":"cara feliz ojos grandes","😄":"sonrisa ojos feliz alegre",
  "😅":"sudor nervioso alivio","😆":"ojos cerrados risa carcajada",
  "😉":"guiño pícaro","😊":"feliz tímido sonrojo contento",
  "😋":"rico comida sabroso","😎":"cool fresco gafas sol",
  "😍":"enamorado ojos corazón amor","🥰":"amor corazones enamorado",
  "😘":"beso amor mua","😗":"beso labios","😙":"beso sonrisa",
  "😚":"beso ojos cerrados","🙂":"leve sonrisa neutral",
  "🤗":"abrazo cariño feliz","🤩":"ojos estrellas emocionado wow",
  "🤔":"pensando duda reflexión","🤨":"ceja duda sospecha",
  "😐":"neutral sin expresión","😑":"aburrido inexpresivo",
  "😶":"silencio sin boca callado","🙄":"ojos arriba molesto hastío",
  "😏":"sonrisa maliciosa pícaro","😣":"angustia esfuerzo",
  "😥":"alivio decepción lágrima","😮":"sorpresa boca abierta",
  "🤐":"boca cerrada silencio secreto","😯":"sorpresa impactado",
  "😪":"cansado sueño bostezo","😫":"agotado cansado estresado",
  "🥱":"bostezo sueño aburrido","😴":"dormido sueño zzz",
  "😌":"alivio relajado contento","😛":"lengua fuera burla",
  "😜":"guiño lengua loco","😝":"lengua ojos humor",
  "😒":"molesto aburrido insatisfecho","😓":"sudor preocupado estrés",
  "😔":"triste decaído deprimido","😕":"confuso dudoso preocupado",
  "🙃":"irónico al revés humor","🤑":"dinero rico codicioso",
  "😲":"sorpresa impactado increíble","☹️":"triste ceño fruncido",
  "🙁":"ligeramente triste","😖":"confundido angustiado",
  "😞":"decepcionado triste","😟":"preocupado nervioso",
  "😤":"frustrado orgulloso vapor nariz","😢":"llorando triste lágrima",
  "😭":"llorando mucho triste sollozando","😦":"descontento sorpresa",
  "😧":"angustiado preocupado","😨":"miedo asustado",
  "😩":"agotado frustrado weary","🤯":"mente explotada impactado",
  "😬":"incómodo nervioso mueca","😰":"miedo ansioso sudor",
  "😱":"terror grito horror miedo","🥵":"caliente fiebre vapor",
  "🥶":"frío helado congelado","😳":"sonrojado avergonzado",
  "🤪":"loco tonto silly","😵":"mareado aturdido vértigo",
  "🥴":"mareado borracho confuso","😠":"enojado molesto",
  "😡":"furioso rojo enojado bravo","🤬":"insultos maldición enojado",
  "😷":"mascarilla enfermo virus","🤒":"enfermo termómetro fiebre",
  "🤕":"herido vendaje accidente","🤢":"náuseas enfermo vomitando",
  "🤮":"vómito náuseas asco","🤧":"estornudo resfriado alérgico",
  "😇":"ángel aureola inocente bendición","🥳":"fiesta celebración cumpleaños",
  "🥺":"súplica ojos tiernos por favor","🤠":"vaquero cowboy sombrero",
  "🤡":"payaso gracioso circo","🤥":"mentiroso nariz larga pinocho",
  "🤫":"silencio shh secreto","🤭":"sorpresa tímido ups",
  "🧐":"monóculo investigando curioso","🤓":"nerd lentes estudioso",
  // Gestos
  "👋":"hola adiós saludo mano","🤚":"mano alto detente",
  "🖐":"mano dedos abierta","✋":"alto detente mano","🖖":"vulcano saludo",
  "👌":"ok perfecto bien","🤌":"perfecto italiano gesto",
  "✌️":"paz victoria dos dedos","🤞":"dedos cruzados suerte",
  "👍":"me gusta aprobado bien pulgar arriba","👎":"no aprobado mal pulgar abajo",
  "👏":"aplausos bravo felicitaciones","🙌":"celebración arriba bien",
  "🤝":"apretón manos acuerdo trato","🙏":"por favor gracias oración ruego",
  "💪":"músculo fuerte fuerza brazo","💅":"uñas elegante manicura",
  // Amor
  "❤️":"corazón rojo amor","🧡":"corazón naranja","💛":"corazón amarillo",
  "💚":"corazón verde","💙":"corazón azul","💜":"corazón morado",
  "🖤":"corazón negro","💔":"corazón roto desamor","❣️":"exclamación corazón",
  "💕":"dos corazones amor","💗":"corazón latido","💖":"corazón brillante",
  "💘":"corazón flecha cupido","💝":"corazón lazo regalo",
  "🌹":"rosa flor amor romántico","💐":"flores ramo regalo",
  "🌷":"tulipán flor rosa","🌸":"flor cerezo primavera",
  // Celebración
  "🎉":"fiesta celebración confeti","🎊":"fiesta sorpresa confeti",
  "🎈":"globo fiesta celebración","🎁":"regalo presente sorpresa",
  "🎂":"pastel cumpleaños torta","🏆":"trofeo campeón ganador",
  "🥇":"oro medalla primero ganador","🎵":"nota musical canción",
  "🎶":"música notas canción","🎸":"guitarra rock música","🎺":"trompeta música",
  "🎷":"saxofón jazz música","🎹":"piano música teclado",
  "🎮":"videojuego jugar consola","🎲":"dado juego azar suerte",
  // Animales
  "🐶":"perro can mascota cachorro","🐱":"gato felino mascota",
  "🐭":"ratón roedor","🐰":"conejo conejito","🦊":"zorro astuto",
  "🐻":"oso pardo","🐼":"panda china oso","🐯":"tigre felino rayas",
  "🦁":"león rey selva rugido","🐮":"vaca leche campo",
  "🐷":"cerdo chancho puerco","🐸":"rana verde anfibio",
  "🐵":"mono primate","🐶":"perro","🦋":"mariposa insecto vuelo",
  "🐢":"tortuga lenta reptil","🐍":"serpiente víbora reptil",
  "🐙":"pulpo tentáculos mar","🦈":"tiburón pez grande mar",
  "🐬":"delfín mar inteligente","🐳":"ballena mar grande",
  "🦄":"unicornio mágico","🐝":"abeja miel insecto",
  "🦋":"mariposa vuelo colores","🐠":"pez tropical colores",
  "🐟":"pez mar agua","🦅":"águila ave rapaz",
  "🦉":"búho nocturno sabio","🦜":"loro pájaro colorido habla",
  // Comida
  "🍕":"pizza italiana comida","🍔":"hamburguesa burger comida",
  "🌮":"taco mexicano comida","🌯":"wrap burrito comida",
  "🥚":"huevo cocina","🍳":"huevo frito sartén cocina",
  "🍲":"olla guiso cocido","🥗":"ensalada saludable verde",
  "🍿":"palomitas cine maíz","🍰":"pastel torta postre",
  "🎂":"pastel cumpleaños torta","🍫":"chocolate dulce cacao",
  "🍪":"galleta dulce cookie","🍩":"dona rosquilla dulce",
  "🍦":"helado soft crema","🍨":"helado crema postre",
  "🧁":"cupcake muffin dulce","☕":"café taza caliente",
  "🍵":"té infusión caliente","🍺":"cerveza bebida alcohol",
  "🍷":"vino copa bebida","🥂":"brindis champán celebración",
  "🍹":"cóctel tropical bebida","🧋":"bubble tea boba bebida",
  "🥐":"croissant pan desayuno","🍞":"pan panadería","🧀":"queso amarillo",
  "🌭":"hot dog perro caliente","🥓":"tocino bacon",
  "🍜":"ramen fideos sopa","🍝":"pasta espagueti italiano",
  "🍣":"sushi japonés arroz","🍱":"bento japonés comida",
  // Lugares
  "🏠":"casa hogar vivienda","🏢":"edificio oficina trabajo",
  "🏥":"hospital médico salud","🏪":"tienda comercio",
  "🏫":"escuela colegio educación","🏦":"banco dinero finanzas",
  "🌍":"mundo tierra planeta globo","🌎":"mundo tierra planeta globo",
  "🏔":"montaña cima nieve","🏖":"playa mar arena verano",
  "🏕":"camping carpa naturaleza","🏝":"isla tropical paraíso",
  "🌋":"volcán lava erupción","🌃":"ciudad noche","🏙":"ciudad skyline",
  "🗼":"torre eiffel paris","🗽":"estatua libertad nueva york",
  "⛩":"torii japonés templo","🕌":"mezquita islam",
  // Deportes
  "⚽":"fútbol balón deporte","🏀":"baloncesto basket NBA",
  "🏈":"fútbol americano NFL","⚾":"béisbol pelota MLB",
  "🎾":"tenis raqueta pelota","🏐":"voleibol","🏊":"nadar piscina natación",
  "🚴":"bicicleta ciclismo pedalear","🏋️":"pesas gym musculación",
  "🧘":"yoga meditación zen paz","🏄":"surf ola mar",
  "🥊":"boxeo pelea guante","🎯":"diana dardo puntería",
  "🏆":"trofeo campeón victoria","🥇":"oro medalla primero",
  // Viajes
  "✈️":"avión vuelo viaje avión","🚀":"cohete espacio nasa",
  "🚗":"auto coche carro vehículo","🚕":"taxi amarillo transporte",
  "🚌":"bus autobús transporte","🚂":"tren locomotora ferrocarril",
  "🚢":"barco crucero mar","🚁":"helicóptero vuelo",
  "🛸":"ovni ufo nave espacial","🏍":"moto motocicleta",
  "🚲":"bici bicicleta ecológico","🧳":"maleta equipaje viaje",
  "⚓":"ancla barco mar","⛽":"gasolina combustible",
  // Objetos
  "💡":"idea bombilla luz","📱":"celular móvil teléfono smartphone",
  "💻":"computadora laptop ordenador","📊":"gráfico estadísticas datos",
  "📈":"alza subida crecimiento","📉":"baja caída descenso",
  "🔒":"candado cerrado seguridad","🔑":"llave acceso puerta",
  "⚙️":"engranaje configuración ajustes","🔧":"llave herramienta arreglar",
  "🔨":"martillo herramienta construir","🔬":"microscopio ciencia laboratorio",
  "🔭":"telescopio astronomía estrellas","📡":"antena señal satélite",
  "💰":"dinero plata billetes","💳":"tarjeta crédito pago",
  "📋":"portapapeles lista documento","📌":"pin chincheta fijar",
  "✂️":"tijeras cortar","🔮":"bola cristal magia futuro",
  "🪄":"varita mágica hechizo","🧲":"imán atraer magnético",
  // Símbolos
  "✅":"check ok correcto aprobado","❌":"x no incorrecto error",
  "❓":"pregunta duda interrogación","❗":"exclamación importante alerta",
  "⚠️":"advertencia cuidado alerta","🚫":"prohibido no permitido",
  "💯":"cien perfecto completo","🔔":"campana notificación alerta",
  "🔕":"sin sonido silencio mudo","📢":"megáfono anuncio",
  "🆕":"nuevo new","🆒":"cool genial","🆓":"gratis free",
  "🆗":"ok correcto","🆘":"socorro ayuda emergencia",
  "🔴":"círculo rojo","🟢":"círculo verde","🔵":"círculo azul",
  "⚫":"círculo negro","⚪":"círculo blanco","🟡":"círculo amarillo",
  "💬":"burbuja mensaje chat comentario","💭":"pensamiento idea burbuja",
  "🗯":"enojo burbuja exclamación","🔊":"volumen alto sonido",
  "🎵":"nota musical canción","🎶":"música notas doble"
};

// Construir índice invertido para búsqueda eficiente
const SEARCH_INDEX = {}; // "palabra" → [emoji, emoji, ...]
(function buildIndex() {
  Object.entries(KW).forEach(([emoji, kws]) => {
    kws.split(" ").forEach(w => {
      w = w.toLowerCase().trim();
      if (!w) return;
      if (!SEARCH_INDEX[w]) SEARCH_INDEX[w] = [];
      SEARCH_INDEX[w].push(emoji);
    });
  });
})();

function searchEmojis(query) {
  const q = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!q) return [];

  const scores = {};

  // 1. Coincidencia exacta de palabra
  Object.entries(SEARCH_INDEX).forEach(([word, emojis]) => {
    const wNorm = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (wNorm === q) {
      emojis.forEach(e => { scores[e] = (scores[e] || 0) + 10; });
    } else if (wNorm.startsWith(q)) {
      emojis.forEach(e => { scores[e] = (scores[e] || 0) + 5; });
    } else if (wNorm.includes(q)) {
      emojis.forEach(e => { scores[e] = (scores[e] || 0) + 2; });
    }
  });

  // 2. Ordenar por score desc, mantener orden original para mismos scores
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([emoji]) => emoji);
}

// ─── Estado ───────────────────────────────────────────────────────────────────
const PICKER_ID  = "_emojiPicker";
const RECENT_KEY = "_ep_recent";
const RECENT_MAX = 24;

let pickerEl      = null;
let activeCategory = "😊";
let searchTimeout  = null;
let isSearching    = false;
let recentEmojis   = [];

function loadRecents() {
  try { recentEmojis = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { recentEmojis = []; }
}
function addRecent(emoji) {
  recentEmojis = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, RECENT_MAX);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentEmojis)); } catch {}
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById("_epStyles")) return;
  const s = document.createElement("style");
  s.id = "_epStyles";
  s.textContent = `
    @keyframes _epIn  { from{opacity:0;transform:translateY(10px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes _epOut { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(6px) scale(.97)} }
    @keyframes _epPop { 0%{transform:scale(1)} 40%{transform:scale(1.4)} 70%{transform:scale(.9)} 100%{transform:scale(1)} }

    #${PICKER_ID} {
      position:fixed;width:338px;height:408px;
      background:rgba(255,255,255,0.97);
      backdrop-filter:blur(24px) saturate(200%);
      -webkit-backdrop-filter:blur(24px) saturate(200%);
      border:1px solid rgba(139,92,246,.14);
      border-radius:18px;
      box-shadow:0 0 0 1px rgba(139,92,246,.06),0 4px 16px rgba(109,40,217,.08),0 20px 60px rgba(88,28,135,.12);
      z-index:99999;display:none;flex-direction:column;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      overflow:hidden;
    }
    #${PICKER_ID}.ep-open  { display:flex; animation:_epIn  .2s cubic-bezier(.34,1.4,.64,1) both }
    #${PICKER_ID}.ep-close { animation:_epOut .13s ease forwards }

    #_epHeader {
      padding:11px 11px 8px;border-bottom:1px solid rgba(0,0,0,.05);flex-shrink:0;
      background:linear-gradient(to bottom,rgba(245,243,255,.7),transparent);
    }
    #_epHeaderRow { position:relative; }
    #_epSearchIco {
      position:absolute;left:10px;top:50%;transform:translateY(-50%);
      font-size:12px;opacity:.4;pointer-events:none;line-height:1;
    }
    #_epSearch {
      width:100%;padding:7.5px 10px 7.5px 30px;box-sizing:border-box;
      background:rgba(243,244,246,.7);border:1.5px solid transparent;
      border-radius:10px;font-size:13px;color:#1f2937;outline:none;
      transition:border-color .18s,background .18s,box-shadow .18s;line-height:1.4;
    }
    #_epSearch:focus { background:#fff;border-color:rgba(139,92,246,.4);box-shadow:0 0 0 3px rgba(139,92,246,.08); }
    #_epSearch::placeholder { color:#b0b8c8;font-size:12.5px; }

    #_epCatBar {
      display:flex;gap:1px;padding:5px 9px;overflow-x:auto;
      scrollbar-width:none;flex-shrink:0;border-bottom:1px solid rgba(0,0,0,.05);
    }
    #_epCatBar::-webkit-scrollbar { display:none }
    ._epCat {
      background:none;border:none;font-size:17px;cursor:pointer;
      padding:5px 6px;border-radius:9px;flex-shrink:0;line-height:1;
      transition:background .14s,transform .14s;position:relative;
    }
    ._epCat:hover { background:rgba(139,92,246,.09);transform:scale(1.12); }
    ._epCat.on { background:rgba(139,92,246,.11); }
    ._epCat.on::after {
      content:'';position:absolute;bottom:2px;left:50%;transform:translateX(-50%);
      width:13px;height:2.5px;background:#7c3aed;border-radius:2px;
    }

    ._epLabel {
      width:100%;padding:5px 10px 2px;font-size:10px;font-weight:700;
      color:#8b5cf6;letter-spacing:.1em;text-transform:uppercase;line-height:1;
    }
    ._epDivider {
      width:calc(100% - 20px);margin:3px 10px;height:1px;
      background:linear-gradient(to right,rgba(139,92,246,.15),transparent);
    }

    #_epGrid {
      flex:1;overflow-y:auto;padding:4px 7px 8px;
      display:flex;flex-wrap:wrap;gap:0;align-content:flex-start;
      scrollbar-width:thin;scrollbar-color:rgba(139,92,246,.2) transparent;
    }
    #_epGrid::-webkit-scrollbar { width:4px }
    #_epGrid::-webkit-scrollbar-thumb { background:rgba(139,92,246,.2);border-radius:4px }
    #_epGrid::-webkit-scrollbar-track { background:transparent }

    ._epE {
      background:none;border:none;font-size:21px;cursor:pointer;
      padding:0;border-radius:9px;line-height:1;
      width:36px;height:36px;display:flex;align-items:center;justify-content:center;
      transition:background .12s,transform .12s;flex-shrink:0;
    }
    ._epE:hover { background:rgba(139,92,246,.10);transform:scale(1.22); }
    ._epE:active { transform:scale(.9); }
    ._epE.pop { animation:_epPop .25s ease; }

    #_epEmpty {
      display:none;flex:1;flex-direction:column;
      align-items:center;justify-content:center;
      gap:7px;color:#c0c8d8;font-size:13px;
    }
    #_epEmpty .ico { font-size:30px;opacity:.4; }

    #_epFooter {
      padding:4px 12px 6px;font-size:10px;color:#d1d5db;letter-spacing:.04em;
      text-align:center;border-top:1px solid rgba(0,0,0,.04);flex-shrink:0;
    }
    #_epFooter b { color:#c4b5fd;font-weight:600; }

    /* Highlight en resultados de búsqueda */
    ._epE.match { background:rgba(139,92,246,.06); }
  `;
  document.head.appendChild(s);
}

// ─── Build picker ──────────────────────────────────────────────────────────────
function buildPicker() {
  injectStyles();
  loadRecents();

  const div = document.createElement("div");
  const currentYear = new Date().getFullYear();
  div.id = PICKER_ID;
  div.innerHTML = `
    <div id="_epHeader">
      <div id="_epHeaderRow">
        <span id="_epSearchIco">🔍</span>
        <input id="_epSearch" type="text" placeholder="Buscar emoji…" autocomplete="off" spellcheck="false">
      </div>
    </div>
    <div id="_epCatBar"></div>
    <div id="_epGrid"></div>
    <div id="_epEmpty"><div class="ico">🔍</div><div>Sin resultados para "<span id="_epEmptyQ"></span>"</div></div>
    <div id="_epFooter"><b>Heavensy</b> &copy; ${currentYear}</div>
  `;
  document.body.appendChild(div);

  // Categorías
  const bar = div.querySelector("#_epCatBar");
  Object.keys(EMOJI_DATA).forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "_epCat" + (cat === activeCategory ? " on" : "");
    btn.textContent = cat; btn.title = CAT_LABELS[cat];
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const s = document.getElementById("_epSearch");
      if (s) s.value = "";
      isSearching = false;
      activeCategory = cat;
      bar.querySelectorAll("._epCat").forEach(b => b.classList.remove("on"));
      btn.classList.add("on");
      renderCat(cat);
    });
    bar.appendChild(btn);
  });

  // Búsqueda con debounce
  const searchEl = div.querySelector("#_epSearch");
  searchEl.addEventListener("input", e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const q = e.target.value.trim();
      isSearching = !!q;
      if (!q) { renderCat(activeCategory); return; }

      const results = searchEmojis(q);
      const emptyQ = document.getElementById("_epEmptyQ");
      if (emptyQ) emptyQ.textContent = q;
      renderGrid(results, `Resultados: "${q}"`, false);
    }, 150);
  });
  searchEl.addEventListener("keydown", e => { if (e.key === "Escape") closePicker(); });

  div.addEventListener("mousedown", e => e.stopPropagation());

  renderCat(activeCategory);
  return div;
}

function renderCat(cat) {
  renderGrid(EMOJI_DATA[cat], CAT_LABELS[cat], !isSearching && recentEmojis.length > 0);
}

function renderGrid(emojis, label, showRecent) {
  const grid  = document.getElementById("_epGrid");
  const empty = document.getElementById("_epEmpty");
  if (!grid) return;
  grid.innerHTML = "";

  if (!emojis?.length) {
    grid.style.display = "none"; empty.style.display = "flex"; return;
  }
  grid.style.display = "flex"; empty.style.display = "none";

  if (showRecent && recentEmojis.length) {
    addLabel(grid, "⏱ Recientes");
    recentEmojis.forEach(e => grid.appendChild(mkBtn(e)));
    const d = document.createElement("div"); d.className = "_epDivider"; grid.appendChild(d);
  }

  if (label) addLabel(grid, label);
  emojis.forEach(e => grid.appendChild(mkBtn(e)));
}

function addLabel(parent, text) {
  const l = document.createElement("div"); l.className = "_epLabel"; l.textContent = text;
  parent.appendChild(l);
}

function mkBtn(emoji) {
  const btn = document.createElement("button");
  btn.className = "_epE"; btn.textContent = emoji; btn.title = KW[emoji]?.split(" ")[0] || emoji;
  btn.addEventListener("click", e => {
    e.stopPropagation();
    btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
    insertEmoji(emoji); addRecent(emoji);
  });
  return btn;
}

function insertEmoji(emoji) {
  const inp = document.getElementById("messageInput");
  if (!inp) return;
  const s = typeof inp.selectionStart === "number" ? inp.selectionStart : inp.value.length;
  const e = typeof inp.selectionEnd   === "number" ? inp.selectionEnd   : inp.value.length;
  inp.value = inp.value.slice(0, s) + emoji + inp.value.slice(e);
  inp.selectionStart = inp.selectionEnd = s + emoji.length;
  inp.focus();
  inp.dispatchEvent(new Event("input", { bubbles: true }));
}

// ─── Abrir / Cerrar ───────────────────────────────────────────────────────────
function openPicker(anchor) {
  if (!pickerEl) pickerEl = buildPicker();
  pickerEl.classList.remove("ep-close");
  pickerEl.style.display = "flex";
  void pickerEl.offsetWidth;
  pickerEl.classList.add("ep-open");

  const r = anchor.getBoundingClientRect(), W = 338, H = 408;
  let top  = r.top - H - 10;
  let left = r.left;
  if (top  < 8)                        top  = r.bottom + 10;
  if (left + W > window.innerWidth - 8) left = window.innerWidth - W - 8;
  if (left < 8)                         left = 8;
  pickerEl.style.top = top + "px"; pickerEl.style.left = left + "px";

  setTimeout(() => {
    loadRecents();
    const s = document.getElementById("_epSearch");
    if (s) { s.value = ""; s.focus(); }
    isSearching = false;
    renderCat(activeCategory);
  }, 20);
}

function closePicker() {
  if (!pickerEl || pickerEl.style.display === "none") return;
  pickerEl.classList.remove("ep-open");
  pickerEl.classList.add("ep-close");
  setTimeout(() => {
    if (pickerEl) { pickerEl.style.display = "none"; pickerEl.classList.remove("ep-close"); }
  }, 130);
}

function togglePicker(btn) {
  (!pickerEl || pickerEl.style.display === "none") ? openPicker(btn) : closePicker();
}

document.addEventListener("mousedown", () => closePicker());
document.addEventListener("keydown", e => { if (e.key === "Escape") closePicker(); });

// ─── Init con MutationObserver ────────────────────────────────────────────────
function initEmojiPicker() {
  const btn = document.getElementById("emojiBtn");
  if (!btn || btn._emojiReady) return false;
  btn._emojiReady = true;
  btn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); togglePicker(btn); });
  console.log("✅ Emoji picker Pro inicializado");
  return true;
}

document.addEventListener("DOMContentLoaded", () => { initEmojiPicker(); });
new MutationObserver(() => {
  const b = document.getElementById("emojiBtn");
  if (b && !b._emojiReady) initEmojiPicker();
}).observe(document.body, { childList: true, subtree: true });