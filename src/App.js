import './App.css';
// Import the functions you need from the SDKs you need
import React from "react";
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, ref, child, get } from "firebase/database";
import Dygraph from 'dygraphs';
import $ from 'jquery';
import { getAuth, signInAnonymously, getIdToken } from "firebase/auth";
import algoliasearch from 'algoliasearch/lite';
//import  from 'algoliasearch'
import instantsearch from 'instantsearch.js';
import { sortBy, searchBox, numericMenu, hierarchicalMenu, stats, hits, clearRefinements, rangeSlider, rangeInput, infiniteHits, panel, menu, refinementList, dynamicWidgets, currentRefinements, toggleRefinement } from 'instantsearch.js/es/widgets';
import { connectRange, connectNumericMenu } from 'instantsearch.js/es/connectors';
import aa from 'search-insights';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Index } from 'react-instantsearch';
import * as d3 from "d3";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDRD6UpATXosNY-xuqZUMtLwphXbpEKpZk",
  authDomain: "filter-database.firebaseapp.com",
  databaseURL: "https://filter-database-default-rtdb.firebaseio.com",
  projectId: "filter-database",
  storageBucket: "filter-database.appspot.com",
  messagingSenderId: "16181759728",
  appId: "1:16181759728:web:c5ceda7f5fc63963d97c35",
  measurementId: "G-WD4YB7D6R7",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);
const dbRef = ref(getDatabase());
const auth = getAuth();

const searchClient = algoliasearch("TSLZITR1T0","35d3f529a5127765ac030443da1cdcc9");
const index = searchClient.initIndex('Filters');

var graph;
const initializeArrayWithValues = (n, val = 0) => Array(n).fill(val);

const shapes = ['Round','Square','Rectangle','Other','Scrap']
const states = ['Other','Finished','Component','Plate']

const search = instantsearch({
  indexName: 'Filters',
  searchClient,
  insights: true,
});

aa('init', {
  appId: 'TSLZITR1T0',
  apiKey: '35d3f529a5127765ac030443da1cdcc9',
});

signInAnonymously(auth)
  .then(() => {
    // Signed in..
    aa('setAuthenticatedUserToken', getIdToken());
  })
  .catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
    // ...
  });
let file;
let keys;
var type = document.getElementById("type");
var scan = document.getElementById("scan");
var currentsnap;
var currentHit;
const units = {'CWL':'nm','HBW':'nm','COn':'nm','COff':'nm','Angle':'°','MaxT':'%T'}

const isElementLoaded = async selector => {
  while ( document.querySelector(selector) === null) {
    await new Promise( resolve =>  requestAnimationFrame(resolve) )
  }
  return document.querySelector(selector);
};

function linkEvent(){
  let filtername = $('.dygraph-title').text()
  navigator.clipboard.writeText('https://filter-database.web.app#'+filtername.substring(0, filtername.length - 4))
}

isElementLoaded('#filtername').then((selector) => {
  if (window.location.hash){
    index.search(window.location.hash, {
      restrictSearchableAttributes: ['filtername']
    }).then(({ hits }) => {
      grabFile2(hits[0])
    });
  }
  document.onclick = hideMenu;
  document.getElementById('addtograph').addEventListener('click',grabFileEvent);
  document.getElementById('downloadcsv').addEventListener('click',csvEvent);
  document.getElementById('graph').addEventListener('contextmenu',rightClickGraph);
  document.getElementById('downloadpng').addEventListener('click',pngEvent);
  document.getElementById('copylink').addEventListener('click',linkEvent);
  document.getElementById('moreinfo').addEventListener('click',openData);/*
  if (document.addEventListener) {
    document.getElementById('filtername').addEventListener('contextmenu', rightClick);
  }*/
});

function openData() {
  var win = window.open('', "Title", "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=600,height=400");
  win.document.body.innerHTML = `
  <!DOCTYPE html>
  <html lang="en">
  Filter Name: ${currentHit.filtername}<br>
  Filter Type: ${currentHit.Design}<br>
  Filter State: ${states[currentHit.FltrType+1]}<br>
  CWL: ${currentHit.CWL}nm<br>
  FWHM: ${currentHit.HBW}nm<br>
  Cut-On: ${currentHit.COn}nm<br>
  Cut-Off: ${currentHit.COff}nm<br>
  Blocking Range 1: ${currentHit.BlkOn1A}nm - ${currentHit.BlkOn2A}nm<br>
  Blocking Range 2: ${currentHit.BlkOff1A}nm - ${currentHit.BlkOff2A}nm<br>
  AOI: ${currentHit.Angle}°<br>
  MaxT: ${currentHit.MaxT}%<br>
  AvgT: ${currentHit.AvgT}%<br>
  Shape: ${shapes[currentHit.Shape*1]}<br>
  Width: ${currentHit.Width}mm<br>
  Height: ${currentHit.Height}mm<br>
  Thickness: ${currentHit.Thick}mm<br>
  Quantity: ${currentHit.RngCnt}<br>
  Batch#: ${currentHit.Batch}<br>
  Part#: ${currentHit['Part#']}<br>
  Saved: ${currentHit.Saved}<br>
  `;
}

function hideMenu() {
  document.getElementById("contextMenu").style.display = "none";
  document.getElementById("contextMenuGraph").style.display = "none"
}

function pngEvent() {
  html2canvas(document.querySelector("#graph")).then(canvas => {
    var image = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
    var dl = document.querySelector("#DLPNG");
    dl.setAttribute('download', 'Image.png');
    dl.setAttribute('href', image);
    dl.click();
	});
}

let objectURL;

function downloadCSV(contents,file) {
  var measuredRange = contents.substring(contents.indexOf('FromA='),contents.indexOf('nRefScan=')).match(/\d+/g);
  var startRange = measuredRange[0]/10;
  var step = Number(measuredRange[2]);
  var transmission = contents.substring(contents.indexOf('[#Trans%]')+11,contents.slice(contents.indexOf('[#Trans%]')+11).indexOf('[#')-1+contents.indexOf('[#Trans%]')+11).split('\n');
  var output = 'Wavelength,Transmission';
  currentHit = undefined;
  for (let i of transmission.keys()){
      output = output + '\n' + ((i*step)+startRange) + ',' + transmission[i]
  }
  if (objectURL) {
    URL.revokeObjectURL(objectURL);  
  }
  let csvdownload = document.getElementById('DL');
  let csvfile = new File([output], file.name.split('.')[0]+".csv",{ type: file.type });
  objectURL = URL.createObjectURL(csvfile);
  csvdownload.download = file.name.split('.')[0]+".csv";
  csvdownload.href = objectURL;
  csvdownload.click();
}

function rightClick(e, hit) {
    e.preventDefault();
    currentHit = hit;
    hideMenu();
    let menu = document.getElementById("contextMenu")
    menu.style.display = 'block';
    menu.style.left = e.pageX + "px";
    menu.style.top = e.pageY + "px";
}

function rightClickGraph(e) {
  e.preventDefault();
  hideMenu();
  let menu = document.getElementById("contextMenuGraph")
  menu.style.display = 'block';
  menu.style.left = e.pageX + "px";
  menu.style.top = e.pageY + "px";
}

function leftClick(hit){
  currentHit = undefined;
  grabFile2(hit);
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isItemInArray(array, item) {
    for (var i = 0; i < array.length; i++) {
        // This if statement depends on the format of your array
        if (array[i][0] == item[0] && array[i][1] == item[1]) {
            return true;   // Found it
        }
    }
    return false;   // Not found
}

function indexOfItem(array, item) {
    for (var i = 0; i < array.length; i++) {
        // This if statement depends on the format of your array
        if (array[i][0] == item[0] && array[i][1] == item[1]) {
            return i;  // Found it
        }
    }
    return -1;   // Not found
}

const merge = (a, b) => {
  const c = [...a];
  b.forEach((bItem) => (c.some((cItem) => arraysEqual(bItem, cItem)) ? null : c.push(bItem)))
  return c;
}

var dropZone = document.getElementById('dropZone');

function showDropZone() {
    dropZone.style.visibility = "visible";
}
function hideDropZone() {
    dropZone.style.visibility = "hidden";
}

function allowDrag(e) {
    if (e.dataTransfer.items) {  // Test that the item being dragged is a valid one
        e.dataTransfer.dropEffect = 'copy';
        e.preventDefault();
    }
}

const acceptedfiles = ['scn','csv'];

function handleDrop(e) {
  e.preventDefault();
  hideDropZone();

  if (acceptedfiles.includes(e.dataTransfer.files[0].name.split('.')[1])) {
    let file = e.dataTransfer.files[0]
    var reader = new FileReader();
    reader.readAsText(file);
    reader.onload =  function(ev){
        var contents = ev.target.result;
        if (!contents) {
            return;
        }
        if (currentGraphs.includes(file.name)) {
          $(`#${currentGraphs.indexOf(file.name)}`).click();
          if (currentHit == undefined){
            $(`.graphfilter:checked`).click();
          }
          if (!$(`#${currentGraphs.indexOf(file.name)}`).prop('checked')){
            $(`#${currentGraphs.indexOf(file.name)}`).click();
          }
        } else if (file.name.split('.')[1] == 'scn') {
          convertContents(contents, file.name);
        } else if (file.name.split('.')[1] == 'csv') {
          convertCSV(contents, file.name);
        }
    };
  } else {
    alert('Invalid File Type (.scn & .csv accepted)')
  }
  d3.csvParseRows(file)
}

function convertCSV(contents, file) {
  console.log(contents)
  var wls = [];
  var transmission = [];
  contents.split(/[\r\n]+/).map(function(w){wls.push([w.split(',')[0]*1])});
  contents.split(/[\r\n]+/).map(function(w){transmission.push([w.split(',')[1]*1])});
  wls = wls.slice(1);
  transmission = transmission.slice(1);
  wls.pop()
  transmission.pop()
  currentHit = undefined;
  if (currentOutput == undefined) {
    var output = [];
    currentLabels = ['Wavelength',file];
    contents.split(/[\r\n]+/).map(function(w){output.push([w.split(',')[0]*1,w.split(',')[1]*1])})
    output = output.slice(1);
    output.pop();
  } else {
    var output = []
    let graphCount = currentOutput[0].length - 1
    let oldwls = []
    currentLabels.push(file)
    currentOutput.map(function(w) {
      oldwls.push([w[0]])
    })
    let merged = merge(wls, oldwls)
    var newwls = merged.sort(function(a, b) {
  		return a[0] - b[0];
		});
    for (let i of newwls.keys()) {
      if (isItemInArray(oldwls,newwls[i])) {
        output.push(currentOutput[indexOfItem(oldwls,newwls[i])]);
      } else {
        if ((oldwls[0][0]<=newwls[0][0] && oldwls[oldwls.length-1][0] >= newwls[i][0])||(oldwls[oldwls.length-1][0]>=newwls[newwls.length-1][0] && oldwls[0][0] <= newwls[i][0])) {
          output.push(newwls[i]);
          output[i] = output[i].concat(output[i-1].slice(1,output[i-1].length-1))
        } else {
          output.push(newwls[i]);
          for (let j = 0; j < graphCount; j++) {
            output[i].push(null);
          }
        }
      }
      if (isItemInArray(wls,newwls[i])) {
        output[i].push(transmission[indexOfItem(wls,newwls[i])] * 1);
      } else {
        output[i].push(null);
      }
    }
  }
  $('.data').show();
  currentOutput = output;
  graph = new Dygraph(
    document.getElementById("graph"),
    output, {
      title: file,
      xlabel: "Wavelength (nm)",
      ylabel: "% Transmission",
      rightGap: 20,
      width: window.innerWidth,
      labels: currentLabels,
      visibility: initializeArrayWithValues(currentLabels.length-2,false).concat(true),
    }
  );
  $('#graphselect').append(`<br><input type="checkbox" class="graphfilter" id="${currentLabels.length-2}" checked><span> ${file}</span>`);
  for (let i = 0;i<currentLabels.length-2;i++) {
    $(`#${i}`).prop('checked',false)
  }
  $(`#${currentLabels.length-2}`).on("click",changeGraph);
}

window.addEventListener('dragenter', function(e) {
    showDropZone();
});

dropZone.addEventListener('dragenter', allowDrag);
dropZone.addEventListener('dragover', allowDrag);

dropZone.addEventListener('dragleave', function(e) {
    hideDropZone();
});

dropZone.addEventListener('drop', handleDrop);

var currentOutput;
var currentLabels;

function convertContents(contents,file) {
  var measuredRange = contents.substring(contents.indexOf('FromA='), contents.indexOf('Linear=')).match(/\d+[.]?[\d]*/g);
  var startRange = measuredRange[0] / 10;
  var endRange = measuredRange[1] / 10;
  var transmission = contents.substring(contents.indexOf('[#Trans%]') + 11, contents.slice(contents.indexOf('[#Trans%]') + 11).indexOf('[#') - 1 + contents.indexOf('[#Trans%]') + 11).split('\n');
  var step = (endRange - startRange) / (transmission.length - 1);
  var wls = [];
  currentHit = undefined;
  for (let i = startRange; i <= endRange; i += step) {
    wls.push([i])
  }
  if (currentOutput == undefined) {
    var output = [];
    currentLabels = ['Wavelength',file];
    for (let i of transmission.keys()) {
      output.push([Math.round(((i * step) + startRange) * 100) / 100, transmission[i] * 1]);
    }
  } else {
    var output = []
    let graphCount = currentOutput[0].length - 1
    let oldwls = []
    currentLabels.push(file)
    currentOutput.map(function(w) {
      oldwls.push([w[0]])
    })
    let merged = merge(wls, oldwls)
    var newwls = merged.sort(function(a, b) {
  		return a[0] - b[0];
		});
    for (let i of newwls.keys()) {
      if (isItemInArray(oldwls,newwls[i])) {
        output.push(currentOutput[indexOfItem(oldwls,newwls[i])]);
      } else {
        if ((oldwls[0][0]<=newwls[0][0] && oldwls[oldwls.length-1][0] >= newwls[i][0])||(oldwls[oldwls.length-1][0]>=newwls[newwls.length-1][0] && oldwls[0][0] <= newwls[i][0])) {
          output.push(newwls[i]);
          output[i] = output[i].concat(output[i-1].slice(1,output[i-1].length-1))
        } else {
          output.push(newwls[i]);
          for (let j = 0; j < graphCount; j++) {
            output[i].push(null);
          }
        }
      }
      if (isItemInArray(wls,newwls[i])) {
        output[i].push(transmission[indexOfItem(wls,newwls[i])] * 1);
      } else {
        output[i].push(null);
      }
    }
  }
  $('.data').show();
  currentOutput = output;
  graph = new Dygraph(
    document.getElementById("graph"),
    output, {
      title: file,
      xlabel: "Wavelength (nm)",
      ylabel: "% Transmission",
      rightGap: 20,
      width: window.innerWidth,
      labels: currentLabels,
      visibility: initializeArrayWithValues(currentLabels.length-2,false).concat(true),
    }
  );
  $('#graphselect').append(`<br><input type="checkbox" class="graphfilter" id="${currentLabels.length-2}" checked><span> ${file}</span>`);
  for (let i = 0;i<currentLabels.length-2;i++) {
    $(`#${i}`).prop('checked',false)
  }
  $(`#${currentLabels.length-2}`).on("click",changeGraph);
}

let visarray=[];

function addContents(contents,file){
  var measuredRange = contents.substring(contents.indexOf('FromA='), contents.indexOf('Linear=')).match(/\d+[.]?[\d]*/g);
  var startRange = measuredRange[0] / 10;
  var endRange = measuredRange[1] / 10;
  var transmission = contents.substring(contents.indexOf('[#Trans%]') + 11, contents.slice(contents.indexOf('[#Trans%]') + 11).indexOf('[#') - 1 + contents.indexOf('[#Trans%]') + 11).split('\n');
  var step = (endRange - startRange) / (transmission.length - 1);
  var wls = [];
  currentHit = undefined;
  for (let i = startRange; i <= endRange; i += step) {
    wls.push([i])
  }
  if (currentOutput == undefined) {
    var output = [];
    currentLabels = ['Wavelength',file];
    for (let i of transmission.keys()) {
      output.push([Math.round(((i * step) + startRange) * 100) / 100, transmission[i] * 1]);
    }
  } else {
    var output = []
    let graphCount = currentOutput[0].length - 1
    let oldwls = []
    currentLabels.push(file)
    currentOutput.map(function(w) {
      oldwls.push([w[0]])
    })
    let merged = merge(wls, oldwls)
    var newwls = merged.sort(function(a, b) {
  		return a[0] - b[0];
		});
    for (let i of newwls.keys()) {
      if (isItemInArray(oldwls,newwls[i])) {
        output.push(currentOutput[indexOfItem(oldwls,newwls[i])]);
      } else {
        if ((oldwls[0][0]<=newwls[0][0] && oldwls[oldwls.length-1][0] >= newwls[i][0])||(oldwls[oldwls.length-1][0]>=newwls[newwls.length-1][0] && oldwls[0][0] <= newwls[i][0])) {
          output.push(newwls[i]);
          output[i] = output[i].concat(output[i-1].slice(1,output[i-1].length-1))
        } else {
          output.push(newwls[i]);
          for (let j = 0; j < graphCount; j++) {
            output[i].push(null);
          }
        }
      }
      if (isItemInArray(wls,newwls[i])) {
        output[i].push(transmission[indexOfItem(wls,newwls[i])] * 1);
      } else {
        output[i].push(null);
      }
    }
  }
  $('.data').show();
  currentOutput = output;
  $('#graphselect').append(`<br><input type="checkbox" class="graphfilter" id="${currentLabels.length-2}" checked><span> ${file}</span>`);
  $(`#${currentLabels.length-2}`).on("click",changeGraph);
  $('.graphfilter').each(function(){visarray.push($(this).prop('checked'))})
  graph = new Dygraph(
    document.getElementById("graph"),
    output, {
      title: file,
      xlabel: "Wavelength (nm)",
      ylabel: "% Transmission",
      rightGap: 20,
      width: window.innerWidth,
      labels: currentLabels,
      visibility: visarray,
    }
  );
}

function changeGraph(el) {
  graph.setVisibility(parseInt(el.target.id), el.target.checked);
}

let csv = false;
let currentGraphs = [];

function csvEvent() {
  csv = true;
  grabFile2(currentHit)
}

function grabFileEvent() {
  grabFile2(currentHit)
}
let filelocation;
function grabFile(filename, filelocation) {
  currentGraphs = [];
  filelocation = `https://storage.googleapis.com/filter-database.appspot.com/Inventory/Surplus/${filelocation}`
  var request = new XMLHttpRequest();
  request.open('GET', filelocation, true);
  request.responseType = 'blob';
  request.onload = function() {
      var reader = new FileReader();
      reader.readAsText(request.response);
      reader.onload =  function(e){
          file = new File([reader.result],`${filename}.scn`)
          var contents = e.target.result;
          if (!contents) {
              return;
          }
          $('#graphselect > span').each(function(){currentGraphs.push($(this).text().trim())})
          if (csv) {
            csv = false;
            downloadCSV(contents, file);
          } else if (currentGraphs.includes(filename)) {
            $(`#${currentGraphs.indexOf(filename)}`).click();
            if (currentHit == undefined){
              $(`.graphfilter:checked`).click();
            }
            if (!$(`#${currentGraphs.indexOf(filename)}`).prop('checked')){
              $(`#${currentGraphs.indexOf(filename)}`).click();
            }
          } else if (currentHit == undefined){
            convertContents(contents, filename);
          } else{
            addContents(contents, filename);
          }
      };
  };
  request.send();
}

function grabFile2(hit) {
  let filename = hit['objectID']
  let design = ''
  try {
    design = hit['Design'];
  } catch (error) {
    design = hit['objectID'].match(/\d+/g)[1];
  }
  if(design === 'BP'){
    design = 'BP_other'
  }
  get(child(dbRef, `Inventory/Surplus/${design}/files`)).then((snapshot) => {
    if (snapshot.exists()) {
      currentsnap = snapshot.val();
      if (currentsnap.includes(filename)){
        filelocation = `${design}/${filename}`
        grabFile(filename, filelocation)
      } else{
        get(child(dbRef, `Inventory/Surplus`)).then((snapshot) => {
        if (snapshot.exists()) {
          currentsnap = snapshot.val();
          keys = Object.keys(currentsnap)
          let i = 0;
          let folder;
          let folders;
          while (i<keys.length-1){
            folders = Object.keys(currentsnap[keys[i]])
            if (folders.length > 1){
              folder = currentsnap[keys[i]][folders[0]]['files']
              if (folder.includes(filename)){
                filelocation = `${keys[i]}/${folders[0]}/${filename}`
                grabFile(filename, filelocation)
                break;
              }
            }
            folder = currentsnap[keys[i]]['files']
            if (folder.includes(filename)){
              filelocation = `${keys[i]}/${filename}`
              grabFile(filename, filelocation)
              break;
            }
            i++
          }

        } else {
          console.log("No data available");
        }
      }).catch((error) => {
        console.error(error);
      });
    }
    } else {
      get(child(dbRef, `Inventory/Surplus`)).then((snapshot) => {
        if (snapshot.exists()) {
          currentsnap = snapshot.val();
          keys = Object.keys(currentsnap)
          let i = 0;
          let folder;
          let folders;
          while (i<keys.length-1){
            folders = Object.keys(currentsnap[keys[i]])
            if (folders.length > 1){
              folder = currentsnap[keys[i]][folders[0]]['files']
              if (folder.includes(filename)){
                filelocation = `${keys[i]}/${folders[0]}/${filename}`
                grabFile(filename, filelocation)
                break;
              }
            }
            folder = currentsnap[keys[i]]['files']
            if (folder.includes(filename)){
              filelocation = `${keys[i]}/${filename}`
              grabFile(filename, filelocation)
              break;
            }
            i++
          }
        } else {
          console.log("No data available");
        }
      }).catch((error) => {
        console.error(error);
      });
    }
  }).catch((error) => {
    console.error(error);
  });
}

let flag = true;
// Create the render function
const renderRangeInput = (renderOptions, isFirstRender) => {
  const { start, range, refine, widgetParams } = renderOptions;
  const [min, max] = start;
  let enteredInput = (max+min)/2;
  let enteredTolerance = (max-min)/2;

  if (isFirstRender) {
    const form = document.createElement('form');
    form.addEventListener('submit', event => {
      event.preventDefault();
      
      const enteredInput = parseFloat(event.target.elements.min.value);
      const enteredTolerance = parseFloat(event.target.elements.max.value);

      const rawMinInputValue = enteredInput-enteredTolerance
      const rawMaxInputValue = enteredInput+enteredTolerance
      
      refine([
        Number.isFinite(rawMinInputValue) ? rawMinInputValue : undefined,
        Number.isFinite(rawMaxInputValue) ? rawMaxInputValue : undefined,
      ]);

      setTimeout(function(){
        if ($(form).parent().prev().prev().hasClass('bp') && flag){
          $(form).parent().nextAll('.cut').click();
          flag = false;
        } else if ($(form).parent().prev().prev().hasClass('cut') && flag){
          $(form).parent().prevAll('.bp').click();
          flag = false;
        }
      },100)
    });

    form.addEventListener('focusout', event => {
      event.preventDefault();

      form.requestSubmit()
      /*
      const enteredInput = parseFloat(event.target.form.elements.min.value);
      const enteredTolerance = parseFloat(event.target.form.elements.max.value);

      const rawMinInputValue = enteredInput-enteredTolerance
      const rawMaxInputValue = enteredInput+enteredTolerance

      refine([
        Number.isFinite(rawMinInputValue) ? rawMinInputValue : undefined,
        Number.isFinite(rawMaxInputValue) ? rawMaxInputValue : undefined,
      ]);*/
    });

    widgetParams.container.appendChild(form);

    return;
  }

  widgetParams.container.querySelector('form').innerHTML = `
    <input
      type="number"
      name="min"
      placeholder="${widgetParams.attribute}"
      value="${Number.isFinite(enteredInput) ? enteredInput : ''}"
      style="width: 60px;"
    />
    <span>${units[widgetParams.attribute]}, ±</span>
    <input
      type="number"
      name="max"
      placeholder="10"
      value="${Number.isFinite(enteredTolerance) ? enteredTolerance : '10'}"
      style="width: 30px;"
    />
    <span>${units[widgetParams.attribute]}</span>
    <input type="submit" hidden />
  `;
};

// Create the custom widget
const customRangeInput = connectRange(
  renderRangeInput
);
// Create the render function
const renderNumericMenu = (renderOptions, isFirstRender) => {
  // `canRefine` is only available from v4.45.0
  // Use `hasNoResults` in earlier minor versions.
  const { items, canRefine, refine, widgetParams } = renderOptions;

  widgetParams.container.innerHTML = `
    <select name="${widgetParams.attribute}">
      ${items
        .map(
          item => `
            <option
              value="${item.value}"
              ${item.isRefined ? 'selected' : ''}
              ${!canRefine ? 'disabled' : ''}
            >
            ${item.label}
            </option>`
        )
        .join('')}
    </select>
  `;

  [...widgetParams.container.querySelectorAll('select')].forEach(element => {
    element.addEventListener('change', event => {
      refine(event.currentTarget.value);
    });
  });
};

// Create the custom widget
const customNumericMenu = connectNumericMenu(
  renderNumericMenu
);


const popupContainer = document.getElementById('popup-container');
const popupContent = document.getElementById('popup-content');

popupContainer.onmouseenter =
            function () {
                popupContent.style.display = 'block';
            };
popupContainer.onmouseleave =
    function () {
        popupContent.style.display = 'none';
    };

const hierarchicalMenuWithPanel = panel({})(hierarchicalMenu);

search.addWidgets([
  searchBox({
    container: "#searchbox",
    searchAsYouType: true,
  }),
  currentRefinements({
    container: '#current-refinements',
    transformItems(items) {
      for (let i in items){
        if (items[i]['attribute'] === 'FltrType'){
          items[i].label = 'Type';
          items[i]['refinements'][0]['label'] = 'Finished';
        } else if (items[i]['attribute'] === 'categories.lvl0') {
          items[i].label = 'Filter Type';
        }
      }
      return items;
    },
  }),
  dynamicWidgets({
    container: '#refinement-list',
    widgets: [
      container =>
        hierarchicalMenuWithPanel({
          container,
          attributes: [
            'categories.lvl0',
            'categories.lvl1',
          ],
          templates: {
            item(data, { html }) {
              return html`
                <a class="${data.cssClasses.link}" href="${data.url}">
                  <span class="${data.cssClasses.label}">${data.label}</span>
                  <span class="${data.cssClasses.count}">
                    ${data.count.toLocaleString()}
                  </span>
                </a>
              `;
            },
          },
        }),
    ],
    maxValuesPerFacet: 100,
  }),
  hierarchicalMenu({
    container: document.querySelector('#refinement-list'),
    attributes: [
      'categories.lvl0',
      'categories.lvl1',
      'categories.lvl2'
    ],
    limit: 100,
    sortBy: ["count"],
    templates: {
      item(data, { html }) {
        return html`
          <a class="${data.cssClasses.link}" href="${data.url}">
            <span class="${data.cssClasses.label}">${data.label}</span>
            <span class="${data.cssClasses.count}">
              ${data.count.toLocaleString()}
            </span>
          </a>
        `;
      },
    },
  }),
  customRangeInput({
    container: document.querySelector('#CWL-Refinement'),
    attribute: 'CWL',
  }),
  customRangeInput({
    container: document.querySelector('#HBW-Refinement'),
    attribute: 'HBW',
  }),
  customRangeInput({
    container: document.querySelector('#COn-Refinement'),
    attribute: 'COn',
  }),
  customRangeInput({
    container: document.querySelector('#COff-Refinement'),
    attribute: 'COff',
  }),
  customNumericMenu({
    container: document.querySelector('#Angle-Refinement'),
    attribute: 'Angle',
    items: [
      { label: 'All' },
      { label: '0°', end: 1 },
      { label: '45°', start: 44, end: 46 },
    ],
  }),
  toggleRefinement({
    container: '#toggle',
    attribute: 'FltrType',
    on: 0,
    templates: {
      labelText({ count }, { html }) {
        if(count == null){count = 0};
        return html`<span>Show Only Finished Filters (${count.toLocaleString()})</span>`;
      },
    },
  }),
  toggleRefinement({
    container: '#sputtered',
    attribute: 'sputtered',
    on: true,
    templates: {
      labelText({ count }, { html }) {
        if(count == null){count = 0};
        return html`<span>Show only Hard-Coated (Sputtered) Filters (${count.toLocaleString()})</span>`;
      },
    },
  }),
  stats({
    container: '#stats',
    templates: {
      text(data, { html }) {
        let count = '';

        if (data.hasManyResults) {
          count += `${data.nbHits} results`;
        } else if (data.hasOneResult) {
          count += `1 result`;
        } else {
          count += `no result`;
        }
  
        return html`<span>${count}</span>`;
      },
    },
  }),
  clearRefinements({
    container: '#clear',
  }),
  sortBy({
    container: '#sort-by',
    items: [
      { label: 'Default', value: 'Filters' },
      { label: 'CWL (asc)', value: 'Filters_CWL_asc' },
      { label: 'CWL (desc)', value: 'Filters_CWL_desc' },
      { label: 'MaxT (asc)', value: 'Filters_MaxT_asc' },
      { label: 'MaxT (desc)', value: 'Filters_MaxT_desc' },
    ],
  }),
  infiniteHits({
    container: "#hits",
    templates: {
      item(hit, { html, components }) {
        return html`
          <article>
            <p onClick="${() => leftClick(hit)}" onContextMenu="${(e) => rightClick(e, hit)}">Filter Name: <u id='filtername'>${components.Highlight({ attribute: 'filtername', highlightedTagName: 'mark', hit })}</u></p>
            <p class="type">Filter Type: ${components.Highlight({ attribute: 'Design', highlightedTagName: 'mark', hit })}</p>
            <p class="cwl">CWL: ${hit.CWL}</p>
            <p class="fwhm">FWHM: ${hit.HBW}</p>
            <p class="con">Cut-On: ${hit.COn}</p>
            <p class="coff">Cut-Off: ${hit.COff}</p>
            <p class="aoi">AOI: ${hit.Angle}</p>
            <p class="maxt">MaxT: ${hit.MaxT}</p>
            <p class="shape">Shape: ${shapes[hit.Shape]}</p>
            <p class="size">Size (mm): ${hit.Width}<span id="height" style="display:none">x${hit.Height}</span></p>
            <script>if(${hit.Shape} > 0){$($('.size:last').children()[0]).show()}</script>
            <hr></hr>
          </article>
        `;
      }
    }
  })
]);

search.start();

$('.reftoggle').on('click',function(e) {
  var cb = e.target;
  let val1 = $(cb).next().next().children().children()[0].value
  let val2 = $(cb).next().next().children().children()[2].value
  let attr = $(cb).attr('id').split('-')[0]
  $('.ais-CurrentRefinements-item').each(function(){
    if ($(this).children()[0].innerHTML.startsWith(attr)){
      $(this).children().children('button').click()
      $(cb).next().next().children().children()[0].value = val1
      $(cb).next().next().children().children()[2].value = val2
    }
  })
  if (cb.checked){
    $(cb).next().removeClass('disabled');
    $(cb).next().next().removeClass('disabled');
    $(cb).next().next().children().prop('disabled',false);
    $(cb).next().next().children().children().prop('disabled',false);
    if (!$('#All-Toggle').checked){
      $('#All-Label').toggleClass('disabled')
      $('#All-Toggle').prop('checked',true)
    }
  } else{
    $(cb).next().addClass('disabled');
    $(cb).next().next().addClass('disabled');
    $(cb).next().next().children().prop('disabled',true);
    $(cb).next().next().children().children().prop('disabled',true);
    if ($('.reftoggle:checked').length == 0){
      $('#All-Label').toggleClass('disabled')
      $('#All-Toggle').prop('checked',false)
    }
  }
})

function App() {
  return (
    <div className="App">
      
    </div>
  );
}

/*

TO-DO LIST

size & shape refinements
- selectable shown refinements (filter data) - DONE!
- URL linking with hash (#filtername=...) - DONE!
- graph editing (remove filter from graph, change visuals) - DONE!
- expandable boxes to view all filter data (right click -> more data) - DONE!
- add and convert both add to graphs list with remove features - DONE!
- drag and drop .scn & .csv files - DONE!
NEEDS BUG FIXING ^^ (open multiple at once - no interpolation i think its bc it isnt properly opening a new graph)
^^^ ALSO CSV PARSING NEEDS MUCH IMPROVEMENT
Interpolation/smoothing like omegascan
translations
thorough bug testing

*/

export default App;