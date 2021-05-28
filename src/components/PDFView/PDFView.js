import makeCancellable from "make-cancellable-promise";
import styles from "./PDFView.module.scss";

import React from "react";
import ReactDOM from "react-dom";

import { PDFViewer, EventBus, PDFSidebar } from "pdfjs-dist/es5/web/pdf_viewer";
import pdfViewerStyle from "pdfjs-dist/es5/web/pdf_viewer.css";
import { getDocument, GlobalWorkerOptions, version } from "pdfjs-dist/es5/build/pdf";
GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.js`;

export default class PDFView extends React.Component {
  state = {
    loaded: false,
    totalPages: 0,
  };

  runningTask = null;

  containerRef = null;

  componentDidMount = async () => {
    await this.loadPDF();
  };

  loadPDF = async () => {
    try {
      const cancelablePDF = makeCancellable(getDocument(this.props.src).promise);
      this.runningTask = cancelablePDF;
      const pdf = await cancelablePDF.promise;
      const container = document.getElementById("container");
      const viewer = document.getElementById("viewer");
      const eventBus = new EventBus();
      //const pdfSidebar = new PDFSidebar();
      const pdfViewer = new PDFViewer({
        container: container,
        viewer: viewer,
        eventBus: eventBus,
        textLayerMode: 2,
      });
      pdfViewer.setDocument(pdf);
      // this.runningTask = null;
      // this.setState({
      //   totalPages: pdf.numPages,
      // });
      //
      // for (let i = 1; i <= pdf.numPages; i++) {
      //   if (i == 1) {
      //     const cancelablePage = makeCancellable(pdf.getPage(i));
      //     this.runningTask = cancelablePage;
      //     const page = await cancelablePage.promise;
      //     this.runningTask = null;
      //     await this.renderPages(page, i);
      //     //  this.handleLoadSuccess();
      //   } else {
      //     pdf.getPage(i).then(page => this.renderPages(page, i));
      //   }
      // }
    } catch (e) {
      console.log(e);
      // this.handleFailure();
    }
  };

  renderPages = async (page, i) => {
    // calculate scale according to the box size
    const boxHeight = this.containerRef.clientHeight;
    const pdfHeight = page.getViewport({ scale: 1 }).height;
    const pdfWidth = page.getViewport({ scale: 1 }).width;
    const scale = boxHeight / pdfHeight;
    const viewport = page.getViewport({ scale: scale });
    // set canvas for page
    const canvas = document.createElement("canvas");
    canvas.id = `canvas-${i}`;
    canvas.setAttribute("data-loading", "true");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const outerDiv = document.createElement("div");
    outerDiv.id = `outer-div-${i}`;
    outerDiv.appendChild(canvas);
    this.containerRef.appendChild(outerDiv);

    // get context and render page
    const context = canvas.getContext("2d");
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    page.render(renderContext);
  };

  render() {
    return (
      <div id="container" className={styles.container} style={pdfViewerStyle}>
        <div id="viewer" className={`pdfViewer ${styles.pdfViewer}`} ref={dom => (this.containerRef = dom)} />
      </div>
    );
  }
}
