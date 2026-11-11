'use client';
import {useId} from 'react';
import {galleryThemes,PaintTheme} from './galleryThemes';

/** Shared header logo. The original supplied artwork is preserved intact.
 * A nested SVG viewport isolates its painted G without redrawing or simplifying it.
 * The adjacent ALLERY and tagline remain crisp vector elements.
 * Keep public/branding/gallery-original.png when integrating this component.
 */
export default function GalleryLogo({theme=galleryThemes[0]}:{theme?:PaintTheme}){
 const uid=useId().replace(/:/g,'');
 const letters=`${uid}-letters`;
 const event=theme.name!==galleryThemes[0].name;
 const stops=event?theme.stops:['#f56ada','#bc86fa','#65deee'];
 return <svg className="gallery-logo" viewBox="0 -13 350 121" role="img" aria-label="Gallery. Anyone can be an artist">
 <defs><linearGradient id={letters}>{stops.map((color,i)=><stop key={i} offset={`${100*i/(stops.length-1)}%`} stopColor={color}/>)}</linearGradient></defs>
 <svg data-layer="original-painted-g" x="-2" y="-12" width="109" height="111" viewBox="285 145 750 765" preserveAspectRatio="xMidYMid meet" overflow="hidden" style={{mixBlendMode:'screen'}} aria-hidden="true">
 <g style={{isolation:'isolate'}}><image href="/branding/gallery-original.png" x="0" y="0" width="1254" height="1254" style={event?{filter:'grayscale(1)'}:undefined}/>{event&&<rect data-layer="event-palette" x="285" y="145" width="750" height="765" fill={`url(#${letters})`} style={{mixBlendMode:'color'}}/>}</g>
 </svg>
 <g data-layer="wordmark" fill="none" stroke={`url(#${letters})`} strokeWidth="1.65" strokeLinecap="square" strokeLinejoin="miter">
 <path d="M108 74L124 30L140 74M151 30V74H176M188 30V74H213M227 30H253M227 52H251M227 74H253M267 74V30H280Q299 30 298 42Q298 54 268 53M282 53L301 74M310 30L327 51L344 30M327 51V74"/>
 </g>
 <text x="108" y="96" fill={`url(#${letters})`} fontFamily="Arial, Helvetica, sans-serif" fontSize="8.4" letterSpacing="2.15">ANYONE CAN BE AN ARTIST</text>
 </svg>;
}
