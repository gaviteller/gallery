export type PaintTheme = { name: string; start?: string; end?: string; stops: string[] };
// Edit these annual MM-DD windows and gradient stops. ISO YYYY-MM-DD dates also work.
export const galleryThemes: PaintTheme[] = [
 {name:'Gallery',stops:['#ff2289','#e52dc5','#8727ed','#2855ff','#22e4ef','#d92bd8','#45efff']},
 {name:'Halloween',start:'10-25',end:'10-31',stops:['#ff7b20','#d34bfa','#762ad4','#ff962d']},
 {name:'Winter holiday',start:'12-15',end:'01-05',stops:['#4ae9eb','#6577ff','#d7edff','#ac55ff']},
 {name:'Spring',start:'03-20',end:'04-10',stops:['#fb75bc','#b98cff','#81e3c6','#ffb5dd']}
];
export function getActiveTheme(date = new Date()): PaintTheme {
 const annual = `${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 const iso = `${date.getFullYear()}-${annual}`;
 return galleryThemes.slice(1).find(t=>{if(!t.start||!t.end)return false;const d=t.start.length===5?annual:iso;return t.start<=t.end?d>=t.start&&d<=t.end:d>=t.start||d<=t.end;}) ?? galleryThemes[0];
}
