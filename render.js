        function createRotationMatrix(axle, angle) {
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            len = Math.sqrt(axle.x**2 + axle.y**2 + axle.z**2);
            axle.x /= len;
            axle.y /= len;
            axle.z /= len;

            const f = 1 - cosA;
            const rot = [
                [axle.x*axle.x*f+       cosA, axle.x*axle.y*f-axle.z*sinA, axle.x*axle.z*f+axle.y*sinA],
                [axle.x*axle.y*f+axle.z*sinA, axle.y*axle.y*f+       cosA, axle.y*axle.z*f-axle.x*sinA],
                [axle.x*axle.z*f-axle.y*sinA, axle.y*axle.z*f+axle.x*sinA, axle.z*axle.z*f+       cosA]
            ];
            return rot;
        }

        function multiplyMatrix(matrix1, matrix2) {
            let result = [[0,0,0],[0,0,0],[0,0,0]];
            for(let i = 0; i < 3; i++) {
                for(let k = 0; k < 3; k++) {
                    for(let j = 0; j < 3; j++) {
                        result[i][k] += matrix1[i][j]*matrix2[j][k];
                    }
                }
            }
            return result;
        }

        function transposeMatrix(matrix) {
            return [
                [matrix[0][0], matrix[1][0], matrix[2][0]],
                [matrix[0][1], matrix[1][1], matrix[2][1]],
                [matrix[0][2], matrix[1][2], matrix[2][2]]
            ];
        }

        function applyMatrix(point, matrix) {
            return {
                x: point.x*matrix[0][0] + point.y*matrix[0][1] + point.z*matrix[0][2],
                y: point.x*matrix[1][0] + point.y*matrix[1][1] + point.z*matrix[1][2],
                z: point.x*matrix[2][0] + point.y*matrix[2][1] + point.z*matrix[2][2]
            };
        }

        // Zeichne aus Punkten Polygonzug in Bild 2 "Ausrichtung Erde"
        function drawPolygonLine(ctx,polygonLine, color,positiveOnly) {
            /*
             * Elipse zeichnen - Punkte des Polygonzuges verbinden
             * Teil der vor der xz-Ebene liegt, durchgezogen zeichnen,
             * Teil dahinter gestrichelt.
             */

            let currentSignNegative = (polygonLine[0].y<0);

            ctx.beginPath();
            ctx.strokeStyle = color;
            //ctx.lineWidth = 1;

            if(currentSignNegative) {
                ctx.setLineDash([2, 2]);
            } else {
                ctx.setLineDash([]);
            }

            ctx.moveTo(polygonLine[0].x, -polygonLine[0].z);

            for(let t = 1; t < polygonLine.length; t++) {
                const point = polygonLine[t];

                ctx.lineTo(point.x, - point.z);
                /*
                 * Wechsel des Vorzeichens: Pfad beenden
                 * und neuen Pfad mit neuem Linienstil beginnen
                 */
                if((point.y<0) != currentSignNegative ||
                   (point.y == 0) && ((t+1) < polygonLine.length) &&
                   ((polygonLine[t+1].y < 0) != currentSignNegative)
                ) {
                    if(!(currentSignNegative && positiveOnly)) {
                        ctx.stroke();
                    }
                    ctx.closePath();

                    currentSignNegative = (point.y<0);
                    if(point.y == 0 && ((t+1) < polygonLine.length)) {
                        currentSignNegative = (polygonLine[t+1].y < 0)
                    }

                    ctx.beginPath();
                    if(currentSignNegative ) {
                        ctx.setLineDash([2, 2]);
                    } else {
                        ctx.setLineDash([]);
                    }
                    ctx.moveTo(point.x, -point.z);
                }
            }
            if(!(currentSignNegative && positiveOnly)) {
                 ctx.stroke();
            }
            ctx.closePath();
        }

        // Berechne Punkte für Polygonzug für einen Breitengrad in Bild 2 "Ausrichtung Erde"
        function calculateLatitudePoints(radius, theta, rotationMatrix) {

            const z = radius*Math.sin(theta); // Höhe des Breitengrads
            const r = radius*Math.cos(theta); // Radius des Breitengrads

            const nrPoints = 40;

            let polygonLine = [];
            let signChange = 0;

            //Erster Punkt in positiver oder negativer Richtung
            const startPoint = applyMatrix({x:1,y:0,z:0},rotationMatrix);
            const startSignNegative = (startPoint.y < 0);

            //Punkte des Breitengrads berechnen und transformieren
            for(let t = 0; t < nrPoints; t++) {
                let point = {
                    x: r*Math.cos(t/nrPoints*2*Math.PI),
                    y: r*Math.sin(t/nrPoints*2*Math.PI),
                    z: z
                };

                point = applyMatrix(point,rotationMatrix);

                /*
                 * Schnittpunkt xz-Ebene ermitteln
                 * Es gibt genau zwei Wechsel, hier ist nur einer interessant
                 */
                if( signChange == 0 && (point.y < 0) != startSignNegative) {
                    signChange = polygonLine.length;
                }
                polygonLine.push(point);
            }
            //Anteil mit gleichem Linienstil "sortieren"
            polygonLine = polygonLine.slice(signChange).concat(polygonLine.slice(0,signChange));
            //geschlossene Kurve erstellen
            polygonLine.push(polygonLine[0]);

            return polygonLine;
        }

        // Berechne Punkte für Polygonzug für einen Längengrad in Bild 2 "Ausrichtung Erde"
        function calculateLongitudePoints(radius,phi, rotationMatrix) {

            const nrOfPoints = 40;

            let lonMatrix = createRotationMatrix({x:0,y:0,z:1},phi);
                lonMatrix = multiplyMatrix(rotationMatrix,lonMatrix);

            let polygonLine = [];

            const startPoint = applyMatrix({x:0,y:0,z:1},lonMatrix);
            const startSign = Math.sign(startPoint.y);

            let signChange = 0;
            for(let t = 0; t <= nrOfPoints; t++) {
                let point = {
                    x: radius*Math.sin(t/nrOfPoints*Math.PI),
                    y: 0,
                    z: radius*Math.cos(t/nrOfPoints*Math.PI)
                };

                point = applyMatrix(point,lonMatrix);
                polygonLine.push(point);
            }
            return polygonLine;
        }
