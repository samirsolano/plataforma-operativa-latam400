// ========================================
// LOGO "SIGMA" — recreado en SVG (no tenemos el archivo original
// del logo, solo se vio pegado en el chat) para los tableros de
// Promotor 5S. Si en algún momento se consigue el PNG/SVG real,
// basta con reemplazar esta constante por un <img src="...">.
// ========================================

const LOGO_SIGMA_SVG = `
<svg class="logo-sigma-svg" viewBox="0 0 260 90" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="SIGMA">
    <defs>
        <clipPath id="sigmaDisco">
            <circle cx="205" cy="45" r="34"/>
        </clipPath>
    </defs>

    <text x="0" y="66" font-family="Arial, 'Segoe UI', sans-serif"
          font-weight="800" font-size="56" fill="#ee2f24" letter-spacing="-1">SIGMA</text>

    <!-- Ícono: hoja + disco partido por 2 chevrones (como el logo real:
         hoja arriba-izquierda, y a la derecha un círculo "cortado" por
         flechas apuntando a la derecha). -->
    <path d="M168 10
             C 182 1, 202 5, 206 18
             C 195 10, 182 8, 172 14
             C 170 13, 169 11, 168 10 Z"
          fill="#6fa82e"/>

    <g clip-path="url(#sigmaDisco)">
        <circle cx="205" cy="45" r="34" fill="#6fa82e"/>
        <polyline points="165,26 190,26 204,45 190,64 165,64"
                   fill="none" stroke="white" stroke-width="7"
                   stroke-linejoin="round" stroke-linecap="round"/>
        <polyline points="165,50 186,50 198,64 186,78 165,78"
                   fill="none" stroke="white" stroke-width="7"
                   stroke-linejoin="round" stroke-linecap="round"/>
    </g>
</svg>
`;
