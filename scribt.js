import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCNokOSiV483vppPmDwtWs0nH1evzZwbjU",
    authDomain: "matriz-de-habilidades-c4bd5.firebaseapp.com",
    databaseURL: "https://matriz-de-habilidades-c4bd5-default-rtdb.firebaseio.com",
    projectId: "matriz-de-habilidades-c4bd5"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const dbRef = ref(db, 'matriz_habilidades');
const PIN_ACCESO = "1432";

let empleados = [];
let criteriosPorPuesto = {};
let empleadoActual = null;

onValue(dbRef, (snapshot) => {
    const data = snapshot.val();
    empleados = data?.empleados || [];
    criteriosPorPuesto = data?.criterios || {};
    renderizarTablas();
});

const sincronizar = () => set(dbRef, { empleados, criterios: criteriosPorPuesto });

function renderizarTablas() {
    const tablaP = document.getElementById("tablaPendientes");
    const tablaR = document.getElementById("tablaResultados");

    if(tablaP) {
        tablaP.innerHTML = empleados.map((e, i) => `
            <tr>
                <td>${e.nombre}</td>
                <td>${e.puesto}</td>
                <td>${e.evaluacion ? '✅ Evaluado' : '⏳ Pendiente'}</td>
                <td><button onclick="iniciarEvaluacion(${i})">Evaluar</button></td>
            </tr>
        `).join('');
    }

    if(tablaR) {
        tablaR.innerHTML = empleados.filter(e => e.evaluacion).map((e) => {
            let realIndex = empleados.indexOf(e);
            return `
            <tr class="${e.evaluacion.resultado === 'Apto' ? 'apto' : 'no-apto'}">
                <td>${e.nombre}</td>
                <td>${e.puesto}</td>
                <td>${e.evaluacion.total}</td>
                <td>${e.evaluacion.porcentaje}%</td>
                <td>${e.evaluacion.resultado}</td>
                <td><button class="btn-excel" onclick="exportarExcelIndividual(${realIndex})">📊 Excel</button></td>
            </tr>`;
        }).join('');
    }
}

window.iniciarEvaluacion = (index) => {
    if (prompt("🔒 PIN:") !== PIN_ACCESO) return alert("Incorrecto");
    empleadoActual = index;
    const emp = empleados[index];
    document.getElementById("tituloEmpleado").innerText = `Evaluando: ${emp.nombre}`;
    if (!criteriosPorPuesto[emp.puesto]) {
        criteriosPorPuesto[emp.puesto] = { habilidades: [], conocimientos: [], antropometria: [] };
    }
    document.getElementById("evaluacion").classList.remove("oculto");
    document.getElementById("listaEmpleados").classList.add("oculto");
    renderizarMatriz(emp.puesto);
};

window.cancelarEvaluacion = () => {
    document.getElementById("evaluacion").classList.add("oculto");
    document.getElementById("listaEmpleados").classList.remove("oculto");
};

window.agregarItem = (tipo) => {
    let puesto = empleados[empleadoActual].puesto;
    let texto = prompt(`Nuevo concepto de ${tipo}:`);
    if (texto) {
        criteriosPorPuesto[puesto][tipo].push(texto);
        sincronizar();
        renderizarMatriz(puesto);
    }
};

function renderizarMatriz(puesto) {
    document.querySelectorAll(".item-criterio").forEach(el => el.remove());
    const emp = empleados[empleadoActual];
    const render = (tipo, id) => {
        let root = document.getElementById(id);
        (criteriosPorPuesto[puesto][tipo] || []).forEach((texto, i) => {
            let fila = document.createElement("tr");
            fila.className = "item-criterio";
            let key = `radio_${tipo}_${i}`;
            let valor = emp.detalleEvaluacion ? emp.detalleEvaluacion.find(d => d.concepto === texto)?.valor : null;
            fila.innerHTML = `<td style="text-align:left">${texto}</td>` + 
                [0,1,2,3,4].map(v => `<td><input type="radio" name="${key}" value="${v}" ${valor == v ? 'checked' : ''}></td>`).join('');
            root.insertAdjacentElement("afterend", fila);
            root = fila;
        });
    };
    render("habilidades", "sec-habilidades");
    render("conocimientos", "sec-conocimientos");
    render("antropometria", "sec-antropometria");
}

window.guardarEvaluacion = () => {
    let emp = empleados[empleadoActual];
    let criterios = criteriosPorPuesto[emp.puesto];
    let total = 0, n = 0, detalles = [];

    ['habilidades', 'conocimientos', 'antropometria'].forEach(t => {
        criterios[t].forEach((text, i) => {
            let radio = document.querySelector(`input[name="radio_${t}_${i}"]:checked`);
            if (radio) {
                let v = parseInt(radio.value);
                total += v; n++;
                detalles.push({ concepto: text, valor: v, categoria: t.toUpperCase() });
            }
        });
    });

    if (n === 0) return alert("Evalúa al menos un punto.");
    let porc = (total / (n * 4)) * 100;
    emp.evaluacion = { total, porcentaje: porc.toFixed(2), resultado: porc >= 70 ? "Apto" : "No apto" };
    emp.detalleEvaluacion = detalles;
    emp.fecha = new Date().toLocaleString();
    sincronizar();
    alert("✅ Guardado");
    cancelarEvaluacion();
};

window.exportarExcelIndividual = (index) => {
    let emp = empleados[index];
    let csv = "\ufeffNombre,Puesto,Puntaje,%,Resultado,Fecha\n";
    csv += `"${emp.nombre}","${emp.puesto}",${emp.evaluacion.total},${emp.evaluacion.porcentaje}%,${emp.evaluacion.resultado},"${emp.fecha}"\n\n`;
    csv += "CATEGORIA,CONCEPTO,CALIFICACION\n";
    emp.detalleEvaluacion.forEach(d => {
        csv += `"${d.categoria}","${d.concepto}",${d.valor}\n`;
    });
    let blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Reporte_${emp.nombre.replace(/ /g,'_')}.csv`;
    a.click();
};
