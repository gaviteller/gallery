'use client';
import {useId} from 'react';
import {PaintTheme} from './galleryThemes';

// Reference-sized silhouette clips out the rest of the supplied screenshot.
// Keep this geometry stable when editing palettes or adding future animation.
// Added center drips are code-drawn: extending the screenshot clip would reveal its UI.
const centerDrips='M466 0H1158V5C1134 4 1120 6 1106 8C1089 11 1082 15 1082 28L1083 41C1084 52 1072 55 1069 44L1069 25C1068 11 1058 8 1041 9C1024 10 1009 15 992 12C975 8 964 11 963 28L965 54C967 67 951 69 948 56L949 30C950 12 938 8 918 10C898 14 882 9 864 12C847 15 841 21 842 31C843 40 832 42 830 33L830 23C828 10 817 9 804 10C788 12 774 8 760 10C744 12 736 21 737 38L739 47C739 59 725 59 724 47L726 30C727 14 714 8 697 10C680 13 666 8 648 10C632 12 621 18 620 29L621 34C621 43 611 44 608 36L608 24C607 12 597 8 580 9C559 10 547 7 530 8C511 9 491 5 466 5Z';
const silhouette='M0 0H1672V10Q1655 5 1649 14Q1644 20 1642 28Q1636 34 1631 23Q1628 13 1614 13Q1588 6 1574 9Q1563 13 1554 8Q1537 1 1527 9Q1518 14 1509 7Q1491 6 1478 16Q1470 22 1474 31Q1477 42 1468 43Q1461 43 1464 34Q1467 22 1458 21Q1448 23 1450 47L1450 64Q1449 76 1441 74Q1435 73 1437 61L1439 37Q1437 20 1425 17Q1414 14 1409 11Q1393 8 1388 20Q1383 31 1385 43Q1388 53 1380 54Q1371 54 1374 43L1373 25Q1371 14 1356 16Q1348 20 1339 17Q1326 16 1322 25Q1323 36 1317 38Q1310 39 1311 30Q1316 23 1307 20Q1277 7 1259 22Q1240 34 1248 67Q1252 79 1247 86Q1243 92 1234 89Q1228 87 1232 73Q1237 58 1231 37Q1224 13 1201 15Q1192 22 1184 13Q1177 6 1164 6L944 7Q927 6 919 8Q911 13 902 9Q882 2 865 10Q853 14 840 9Q819 2 807 10Q803 12 800 20Q794 24 789 17Q787 10 775 9Q753 3 731 6Q717 13 703 7Q679 4 664 8Q653 12 642 7L466 5Q438 4 433 9Q432 17 425 16Q421 11 414 10Q395 5 379 16Q370 22 360 26Q350 33 355 56Q358 71 350 73Q340 75 344 59Q349 40 342 32Q337 33 340 40Q340 46 333 45Q326 45 329 37Q330 29 319 25Q311 24 301 18Q272 8 260 22Q251 29 254 32Q250 39 242 35Q236 31 235 27Q224 24 217 26Q209 27 201 20Q174 3 155 12Q149 14 145 18Q138 23 130 16Q122 10 112 11Q91 3 68 12Q44 16 38 27Q29 39 33 64Q36 80 30 85Q19 90 20 76Q25 50 21 28Q19 15 9 14L0 13Z';

/** Shared header/promo paint. Original reference texture is a local asset.
 * Default preserves its pink/blue/cyan colors. Event stops recolor the same
 * clipped paint with a color blend, retaining photographic light and depth.
 */
export default function GalleryPaintDrips({theme,small=false}:{theme:PaintTheme;small?:boolean}){
 const uid=useId().replace(/:/g,'');const clip=`${uid}-shape`,gradient=`${uid}-palette`,glow=`${uid}-glow`,depth=`${uid}-depth`,center=`${uid}-center`,shine=`${uid}-shine`,feather=`${uid}-feather`,join=`${uid}-join`,centerClip=`${uid}-center-clip`;
 const event=theme.name!=='Gallery';
 return <svg className={small?'paint paint-small':'paint'} viewBox="0 0 1672 110" preserveAspectRatio="none" aria-hidden="true" style={{isolation:'isolate'}}>
 <defs>
 <linearGradient id={center} gradientUnits="userSpaceOnUse" x1="466" y1="0" x2="1158" y2="0">{(event?theme.stops.map((color,i,arr)=>({color,offset:i/(arr.length-1)})):[{color:'#8312f3',offset:0},{color:'#6f15f1',offset:.078},{color:'#0861ec',offset:.208},{color:'#01a8f5',offset:.382},{color:'#0263f4',offset:.533},{color:'#0174f8',offset:.699},{color:'#1b3ef0',offset:.88},{color:'#1d39f6',offset:1}]).map((stop,i)=><stop key={i} offset={`${100*stop.offset}%`} stopColor={stop.color}/>)}</linearGradient>
 <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff" stopOpacity="0"/><stop offset=".28" stopColor="#052264" stopOpacity=".12"/><stop offset=".7" stopColor="#020620" stopOpacity=".5"/><stop offset="1" stopColor="#90dcff" stopOpacity=".3"/></linearGradient>
 <linearGradient id={join} gradientUnits="userSpaceOnUse" x1="466" y1="0" x2="1158" y2="0"><stop stopColor="white" stopOpacity="0"/><stop offset=".09" stopColor="white"/><stop offset=".91" stopColor="white"/><stop offset="1" stopColor="white" stopOpacity="0"/></linearGradient>
 <mask id={feather} maskUnits="userSpaceOnUse" x="466" y="0" width="692" height="100"><rect x="466" width="692" height="100" fill={`url(#${join})`}/></mask>
 <clipPath id={centerClip}><path d={centerDrips}/></clipPath>
 <clipPath id={clip}><path d={silhouette}/></clipPath>
 <linearGradient id={gradient}>{theme.stops.map((color,i)=><stop key={i} offset={`${100*i/(theme.stops.length-1)}%`} stopColor={color}/>)}</linearGradient>
 <linearGradient id={depth} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#050719" stopOpacity="0"/><stop offset="1" stopColor="#050719" stopOpacity=".1"/></linearGradient>
 <filter id={glow} x="-5%" y="-60%" width="110%" height="240%"><feGaussianBlur stdDeviation="2.5"/></filter>
 </defs>
 <g data-layer="glow" opacity=".16" filter={`url(#${glow})`}><path d={silhouette} fill={`url(#${gradient})`}/></g>
 <g data-layer="silhouette" clipPath={`url(#${clip})`}>
 <image data-layer="reference-texture-and-highlights" href="/branding/gallery-paint-reference.png" x="0" y="0" width="1672" height="941" style={event?{filter:'grayscale(1)'}:undefined}/>
 {event&&<path data-layer="editable-gradient" d={silhouette} fill={`url(#${gradient})`} style={{mixBlendMode:'color'}}/>}
 <path data-layer="internal-depth" d={silhouette} fill={`url(#${depth})`} opacity=".15"/>
 </g>
 <g data-layer="extended-center-drips" mask={`url(#${feather})`}>
 <path d={centerDrips} fill={`url(#${center})`}/>
 <path d={centerDrips} fill={`url(#${shine})`}/>
 <g clipPath={`url(#${centerClip})`}><path d={centerDrips} fill="none" stroke="#b4eaff" strokeWidth="1.7" opacity=".65"/></g>
 <path d="M611 23L611 34M729 31L728 46Q729 53 734 50M952 29L952 52Q953 62 960 59M1073 25L1073 41" fill="none" stroke="#bcf5ff" strokeWidth="1.1" strokeLinecap="round" opacity=".48"/>
 <path d="M480 5Q510 9 533 7M653 9Q672 12 688 10M887 10Q905 13 918 10M1010 11Q1027 8 1041 9" fill="none" stroke="#a3e6ff" strokeWidth=".8" opacity=".4"/>
 </g>
 </svg>;
}
