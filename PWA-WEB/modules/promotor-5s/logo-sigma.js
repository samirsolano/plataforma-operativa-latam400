// ========================================
// LOGO "SIGMA" — archivo real (assets/logo-sigma.jpg), no una
// recreación. El archivo viene con fondo negro sólido (no es un PNG
// transparente), así que acá se "recorta" ese negro por canvas antes
// de mostrarlo, para que no aparezca un cuadro negro sobre el chip
// blanco del banner.
// ========================================

const LOGO_SIGMA_SRC = "assets/logo-sigma.jpg";

let logoSigmaUrlCache = null;

function cargarLogoSigmaTransparente(){

    if(logoSigmaUrlCache){
        return Promise.resolve(logoSigmaUrlCache);
    }

    return new Promise(function(resolve){

        const img = new Image();

        img.onload = function(){

            try{

                const canvas = document.createElement("canvas");
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;

                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0);

                const datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const pixeles = datos.data;

                // El fondo del archivo es negro sólido; el logo en sí
                // (rojo/verde) siempre tiene algún canal bien alto, así
                // que usar el canal más brillante como "oscuridad" no
                // afecta al logo, solo al fondo. Se suaviza el borde
                // (30-70) para no dejar un halo duro por la compresión
                // JPEG.
                for(let i = 0; i < pixeles.length; i += 4){

                    const brillo = Math.max(pixeles[i], pixeles[i + 1], pixeles[i + 2]);

                    if(brillo <= 30){
                        pixeles[i + 3] = 0;
                    }else if(brillo < 70){
                        pixeles[i + 3] = Math.round(255 * (brillo - 30) / 40);
                    }

                }

                ctx.putImageData(datos, 0, 0);

                logoSigmaUrlCache = canvas.toDataURL("image/png");
                resolve(logoSigmaUrlCache);

            }catch(e){

                console.error("No se pudo recortar el fondo del logo SIGMA", e);
                resolve(LOGO_SIGMA_SRC);

            }

        };

        img.onerror = function(){
            resolve(LOGO_SIGMA_SRC);
        };

        img.src = LOGO_SIGMA_SRC;

    });

}
