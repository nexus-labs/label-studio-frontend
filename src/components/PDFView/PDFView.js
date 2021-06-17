import makeCancellable from "make-cancellable-promise";
import styles from "./PDFView.module.scss";

import React from "react";
import ReactDOM from "react-dom";

import {
  EventBus,
  PDFPageView,
  DefaultTextLayerFactory,
  DefaultAnnotationLayerFactory,
} from "pdfjs-dist/es5/web/pdf_viewer";
import pdfViewerStyle from "pdfjs-dist/es5/web/pdf_viewer.css";
import { getDocument, GlobalWorkerOptions, version } from "pdfjs-dist/es5/build/pdf";
import { observer } from "mobx-react";
import { isAlive } from "mobx-state-tree";
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

  get clientHeight() {
    return this.containerRef.clientHeight;
  }

  get clientWidh() {
    return this.containerRef.clientWidh;
  }

  loadPDF = async () => {
    const { parent } = this.props;
    try {
      const cancelablePDF = makeCancellable(getDocument(this.props.src).promise);
      this.runningTask = cancelablePDF;
      const pdf = await cancelablePDF.promise;
      const viewer = document.getElementById("viewer");
      const eventBus = new EventBus();

      for (let i = 1; i <= pdf.numPages; i++) {
        pdf.getPage(i).then(pdfPage => {
          const viewport = pdfPage.getViewport({ scale: 1 });
          var pdfPageView = new PDFPageView({
            container: viewer,
            id: `${i}`,
            scale: 1.0,
            eventBus: eventBus,
            defaultViewport: viewport.clone(),
            textLayerMode: 2,
            textLayerFactory: new DefaultTextLayerFactory(),
            annotationLayerFactory: new DefaultAnnotationLayerFactory(),
          });
          if (i === 1) {
            parent.loadFinished(viewport.height, viewport.width);
          }
          pdfPageView.setPdfPage(pdfPage);
          return pdfPageView.draw();
        });
      }
    } catch (e) {
      console.log(e);
    }
  };

  render() {
    const { item, store } = this.props;
    if (!isAlive(item)) return null;
    return (
      <div id="container" className={styles.container} style={pdfViewerStyle}>
        <div id="viewer" className={`pdfViewer ${styles.pdfViewer}`} ref={dom => (this.containerRef = dom)} />
      </div>
    );
  }
}
