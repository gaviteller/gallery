import type { SVGProps } from "react"

export default function GalleryPaintDrips(props: SVGProps<SVGSVGElement>) {
  const paintPath = "M0 0H1440V22C1405 19 1384 30 1350 25C1318 20 1292 10 1258 18C1226 25 1210 43 1184 34C1164 27 1154 17 1131 20C1105 23 1090 29 1066 25C1036 20 1012 9 983 17C954 25 941 41 917 34C895 27 883 16 859 19C833 23 817 31 793 27C764 22 743 10 714 17C683 24 670 41 645 35C621 28 610 16 584 20C558 24 543 31 519 27C489 21 469 9 438 17C409 25 398 43 373 36C349 29 337 15 312 20C285 25 272 34 247 29C218 23 194 10 166 19C137 28 126 45 101 37C76 29 60 17 34 22C19 25 10 29 0 31ZM31 27C31 52 25 78 29 105C31 118 43 119 48 106C55 80 43 52 48 27ZM369 31C368 52 362 70 365 91C367 103 378 104 382 91C387 69 377 51 381 30ZM544 27C542 58 533 83 538 110C541 125 554 124 559 109C565 82 552 57 558 26ZM640 30C638 48 633 62 636 79C638 89 647 90 651 79C656 61 647 47 652 29ZM789 25C786 56 778 82 783 108C786 123 799 124 804 108C810 80 798 55 804 24ZM913 30C910 51 906 68 910 87C912 98 922 99 926 87C931 67 921 50 926 29ZM1063 25C1060 55 1053 78 1057 101C1060 115 1072 116 1077 101C1083 77 1071 54 1078 25ZM1181 30C1179 49 1174 64 1177 82C1179 93 1189 94 1193 82C1198 63 1189 48 1194 29ZM1348 24C1345 56 1337 86 1342 113C1345 129 1358 130 1363 113C1369 84 1357 55 1364 24Z"

  return (
    <svg viewBox="0 0 1440 150" preserveAspectRatio="none" aria-hidden="true" {...props}>
      <defs className="gallery-paint-gradient">
        <linearGradient id="galleryPaintGradient" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff23ad" />
          <stop offset=".26" stopColor="#ef24d2" />
          <stop offset=".5" stopColor="#9d3cff" />
          <stop offset=".72" stopColor="#545cff" />
          <stop offset="1" stopColor="#12c9ff" />
        </linearGradient>
        <linearGradient id="galleryPaintHighlight" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffd0ef" /><stop offset=".48" stopColor="#e5c6ff" /><stop offset="1" stopColor="#c9f7ff" />
        </linearGradient>
        <linearGradient id="galleryPaintDepth" x1="0" y1="0" x2="0" y2="150" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".28" />
          <stop offset=".18" stopColor="#ffffff" stopOpacity=".06" />
          <stop offset=".62" stopColor="#271253" stopOpacity=".2" />
          <stop offset="1" stopColor="#05030c" stopOpacity=".38" />
        </linearGradient>
        <linearGradient id="galleryPaintRim" x1="0" y1="0" x2="0" y2="125" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".92" />
          <stop offset=".32" stopColor="#ffe6fb" stopOpacity=".54" />
          <stop offset=".72" stopColor="#b9eaff" stopOpacity=".22" />
          <stop offset="1" stopColor="#ffffff" stopOpacity=".08" />
        </linearGradient>
        <linearGradient id="galleryPaintUnderside" x1="0" y1="8" x2="0" y2="132" gradientUnits="userSpaceOnUse">
          <stop offset=".2" stopColor="#20072f" stopOpacity="0" />
          <stop offset=".72" stopColor="#10051e" stopOpacity=".28" />
          <stop offset="1" stopColor="#020108" stopOpacity=".62" />
        </linearGradient>
        <filter id="galleryPaintGlow" x="-8%" y="-35%" width="116%" height="190%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="galleryPaintSpecular" x="-10%" y="-20%" width="120%" height="150%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="softAlpha" />
          <feSpecularLighting in="softAlpha" surfaceScale="4" specularConstant=".75" specularExponent="22" lightingColor="#ffffff" result="shine">
            <feDistantLight azimuth="225" elevation="58" />
          </feSpecularLighting>
          <feComposite in="shine" in2="SourceAlpha" operator="in" result="clippedShine" />
          <feBlend in="SourceGraphic" in2="clippedShine" mode="screen" />
        </filter>
      </defs>

      <g className="gallery-paint-geometry">
        <path d={paintPath} fill="url(#galleryPaintGradient)" filter="url(#galleryPaintGlow)" />
        <path d={paintPath} fill="url(#galleryPaintDepth)" opacity=".72" filter="url(#galleryPaintSpecular)" />
        <path d={paintPath} fill="url(#galleryPaintUnderside)" opacity=".72" />
        <path d={paintPath} fill="none" stroke="#090213" strokeOpacity=".58" strokeWidth="2.4" />
      </g>
      <g className="gallery-paint-highlight" fill="none" stroke="url(#galleryPaintHighlight)" strokeLinecap="round">
        <path d="M4 20C44 10 75 31 106 24C137 17 150 7 181 14C211 21 231 33 260 26C290 18 303 8 332 14" strokeWidth="2.4" opacity=".92" />
        <path d="M407 15C440 7 463 27 492 21C520 15 533 7 560 12M686 14C716 7 738 25 767 20C797 15 811 7 839 12M972 14C1001 7 1025 25 1054 19M1224 17C1254 8 1282 25 1311 19C1342 12 1371 20 1408 16" strokeWidth="2.2" opacity=".85" />
        <path d="M37 34C35 57 31 82 36 105M548 34C545 60 542 83 547 108M793 32C790 57 787 82 792 107M1353 31C1350 59 1347 87 1352 112" strokeWidth="2" opacity=".58" />
        <path d="M44 30C42 53 38 77 41 95M374 35C371 52 370 69 373 83M553 31C550 57 547 80 551 99M645 34C643 49 642 63 644 72M798 29C795 55 792 78 796 98M918 34C916 51 915 66 918 78M1069 29C1066 53 1064 74 1067 91M1187 34C1185 50 1184 64 1186 74M1358 28C1355 56 1353 82 1357 103" strokeWidth="1.15" opacity=".86" />
      </g>
      <g className="gallery-paint-rim-light" fill="none" stroke="url(#galleryPaintRim)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 29C19 22 27 20 43 22C66 25 78 39 101 37C126 35 137 18 166 19C194 19 218 32 247 29C272 27 285 20 312 20C337 20 349 36 373 36C398 36 409 20 438 17" strokeWidth="1.25" opacity=".7" />
        <path d="M584 20C610 16 621 34 645 35C670 36 683 19 714 17C743 15 764 27 793 27C817 27 833 20 859 19C883 18 895 33 917 34M983 17C1012 13 1036 26 1066 25C1090 24 1105 18 1131 20C1154 22 1164 34 1184 34M1258 18C1292 12 1318 27 1350 25C1384 23 1405 17 1438 22" strokeWidth="1.15" opacity=".68" />
        <path d="M31 32C31 55 27 79 30 101C31 110 36 115 41 111M369 36C368 54 365 72 367 87C368 95 372 99 376 95M544 33C542 59 537 84 540 105C541 115 546 121 551 116M640 35C639 51 636 64 638 76C639 83 643 86 647 82M789 31C787 58 782 83 785 104C786 114 792 120 797 115M913 35C911 53 909 69 912 83C913 91 917 95 921 91M1063 31C1061 56 1058 79 1060 97C1061 107 1066 112 1071 107M1181 35C1180 51 1177 66 1179 78C1180 86 1184 90 1188 86M1348 30C1346 58 1341 87 1344 108C1345 119 1350 125 1355 119" strokeWidth="1.45" opacity=".62" />
      </g>
      <g className="gallery-paint-glints" fill="#ffffff">
        <ellipse cx="39" cy="104" rx="2.1" ry="4.8" opacity=".66" />
        <ellipse cx="374" cy="89" rx="1.7" ry="3.7" opacity=".52" />
        <ellipse cx="550" cy="108" rx="2" ry="4.6" opacity=".58" />
        <ellipse cx="646" cy="78" rx="1.5" ry="3.1" opacity=".48" />
        <ellipse cx="796" cy="107" rx="2" ry="4.5" opacity=".56" />
        <ellipse cx="921" cy="86" rx="1.6" ry="3.4" opacity=".46" />
        <ellipse cx="1070" cy="100" rx="1.9" ry="4.2" opacity=".52" />
        <ellipse cx="1188" cy="81" rx="1.5" ry="3.2" opacity=".45" />
        <ellipse cx="1356" cy="111" rx="2.1" ry="4.8" opacity=".62" />
      </g>
    </svg>
  )
}
