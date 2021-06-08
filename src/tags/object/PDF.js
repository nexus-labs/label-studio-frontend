import React, { Component } from "react";
import { observer, inject } from "mobx-react";
import { types, getRoot, getType } from "mobx-state-tree";

import ObjectBase from "./Base";
import ProcessAttrsMixin from "../../mixins/ProcessAttrs";
import ObjectTag from "../../components/Tags/Object";
import Registry from "../../core/Registry";
import { ErrorMessage } from "../../components/ErrorMessage/ErrorMessage";
import { PDFRegionModel } from "../../regions";
// import { restoreNewsnapshot } from "../../core/Helpers";
import RegionsMixin from "../../mixins/Regions";
// import * as xpath from "xpath-range";
// import { splitBoundaries } from "../../utils/html";
import { parseValue } from "../../utils/data";
// import Utils from "../../utils";
import PDFView from "../../components/PDFView/PDFView";

import styles from "./PDF/PDF.module.scss";
import Utils from "../../utils";
import * as xpath from "xpath-range";
import { splitBoundaries } from "../../utils/html";
import ToolsManager from "../../tools/Manager";
import * as Tools from "../../tools";

const TagAttrs = types.model("PDFModel", {
  name: types.identifier,
  value: types.maybeNull(types.string),
});

const Model = types
  .model("PDFModel", {
    type: "pdf",
    _value: types.optional(types.string, ""),
    _update: types.optional(types.number, 1),
  })
  .views(self => ({
    get hasStates() {
      const states = self.states();
      return states && states.length > 0;
    },

    get annotation() {
      return getRoot(self).annotationStore.selected;
    },

    get regs() {
      return self.annotation.regionStore.regions.filter(r => r.object === self);
    },

    states() {
      return self.annotation.toNames.get(self.name);
    },

    activeStates() {
      const states = self.states();
      return states && states.filter(s => s.isSelected && s.type === "labels");
    },
  }))
  .actions(self => ({
    setRef(ref) {
      self._ref = ref;
    },

    needsUpdate() {
      self._update = self._update + 1;
    },

    updateValue(store) {
      self._value = parseValue(self.value, store.task.dataObj);
    },

    createRegion(p) {
      console.log(`createRegion: ${p}`);
      const r = PDFRegionModel.create({
        pid: p.id,
        ...p,
      });

      r._range = p._range;

      self.regions.push(r);
      self.annotation.addRegion(r);

      return r;
    },

    addRegion(range) {
      const states = self.getAvailableStates();
      if (states.length === 0) return;
      const control = states[0];
      const labels = { [control.valueType]: control.selectedValues() };
      const area = self.annotation.createResult(range, labels, control, self);
      area._range = range._range;
      return area;
    },

    /**
     *
     * @param {*} obj
     * @param {*} fromModel
     */
    fromStateJSON(obj, fromModel) {
      // TODO: need to implement
      console.log("fromStateJSON...");
      const fm = self.annotation.names.get(obj.from_name);
      fm.fromStateJSON(obj);
      if (!fm.perregion && fromModel.type !== "labels") return;
    },
  }));

const PDFModel = types.compose("PDFModel", TagAttrs, Model, ProcessAttrsMixin, ObjectBase);

class HtxPDFView extends Component {
  render() {
    const { item, store } = this.props;
    return <HtxPDFPieceView store={store} item={item} />;
  }
}

class PDFPieceView extends Component {
  constructor(props) {
    super(props);
    this.myRef = React.createRef();
    this.viewerRef = React.createRef();
    this.state = {
      loaded: false,
      pdfHeight: 0,
      pdfWidth: 0,
    };
  }

  getValue() {
    const { item, store } = this.props;
    return parseValue(item.value, store.task.dataObj);
  }

  captureDocumentSelection(ev) {
    var i,
      self = this,
      ranges = [],
      rangesToIgnore = [],
      selection = window.getSelection();

    if (selection.isCollapsed) return [];

    const granularityDisabled = ev.altKey;

    for (i = 0; i < selection.rangeCount; i++) {
      var r = selection.getRangeAt(i);

      try {
        const page = r.commonAncestorContainer.parentElement.closest(".page");
        var normedRange = xpath.fromRange(r, self.myRef);

        splitBoundaries(r);

        normedRange._range = r;
        normedRange.page = parseInt(page.getAttribute("data-page-number"), 10);

        // Range toString() uses only text nodes content
        // so to extract original new lines made into <br>s we should get all the tags
        const tags = Array.from(r.cloneContents().childNodes);
        // and convert every <br> back to new line
        const text = tags.reduce((str, node) => (str += node.tagName === "BR" ? "\n" : node.textContent), "");
        normedRange.text = text;

        const ss = Utils.HTML.toGlobalOffset(self.myRef, r.startContainer, r.startOffset);
        const ee = Utils.HTML.toGlobalOffset(self.myRef, r.endContainer, r.endOffset);

        // normedRange.startOffset = ss;
        // normedRange.endOffset = ee;
        normedRange.height = r.commonAncestorContainer.parentElement.offsetHeight;
        normedRange.width = r.commonAncestorContainer.parentElement.offsetWidth;
        normedRange.x = r.commonAncestorContainer.parentElement.offsetTop;
        normedRange.y = r.commonAncestorContainer.parentElement.offsetLeft;
        //console.log(r.commonAncestorContainer.parentElement);

        console.log(normedRange);
        // If the new range falls fully outside our this.element, we should
        // add it back to the document but not return it from this method.
        if (normedRange === null) {
          rangesToIgnore.push(r);
        } else {
          ranges.push(normedRange);
        }
      } catch (err) {}
    }

    // BrowserRange#normalize() modifies the DOM structure and deselects the
    // underlying text as a result. So here we remove the selected ranges and
    // reapply the new ones.
    selection.removeAllRanges();

    return ranges;
  }

  onClick(ev) {
    // console.log('click');
  }

  onMouseUp(ev) {
    console.log(`onMouseUp: ${ev}`);
    const item = this.props.item;
    //if (!item.selectionenabled) return;

    const states = item.activeStates();
    if (!states || states.length === 0) return;

    var selectedRanges = this.captureDocumentSelection(ev);
    if (selectedRanges.length === 0) return;

    // prevent overlapping spans from being selected right after this
    item._currentSpan = null;

    const htxRange = item.addRegion(selectedRanges[0]);
    if (htxRange) {
      console.log(`onMouseUp: ${htxRange}`);

      const spans = htxRange.createSpans();
      htxRange.addEventsToSpans(spans);
    }
  }

  _handleUpdate() {
    if (!this.state.loaded) {
      return;
    }

    const root = this.myRef;
    const { item } = this.props;

    const sleep = async ms => {
      await new Promise(resolve => setTimeout(resolve, ms));
    };

    const checkItems = async r => {
      console.log(r.page);
      console.log(r.x);
      console.log(r.y);
      // spans can be totally missed if this is app init or undo/redo
      // or they can be disconnected from DOM on annotations switching
      // so we have to recreate them from regions data
      if (r._spans?.[0]?.isConnected) return;

      const pdfHeight = this.state.pdfHeight;

      const findNode = (el, left, top) => {
        // let left = _left;
        // let top = _top;
        const traverse = (node, _left, _top) => {
          console.log(node);
          console.log(`top: ${top}, offsetTop: ${_top}`);
          if (top <= _top && left <= _left) {
            if (node.nodeName === "#text") {
              return node;
            }
          }

          for (var i = 0; i <= node.childNodes?.length; i++) {
            const n = node.childNodes[i];
            if (n) {
              const offetLeft = _left + (n.offsetLeft ? n.offsetLeft : 0);
              const offsetTop = _top + (n.offsetTop ? n.offsetTop : 0);
              const res = traverse(n, offetLeft, offsetTop);
              if (res) return res;
            }
          }
        };

        return traverse(el, el.offsetLeft, el.offsetTop);
      };

      const page = document.querySelector(`div[data-page-number="${r.page}"]`);
      let textLayer = page.querySelector(".textLayer");
      while (textLayer === null || textLayer === undefined) {
        console.log(`start: ${new Date()}`);
        await sleep(1000);
        console.log(`end: ${new Date()}`);
        textLayer = page.querySelector(".textLayer");
      }
      console.log(page);
      console.log(textLayer);
      console.log(`pdfHeight: ${pdfHeight}, clientHeight: ${textLayer.clientHeight}`);
      const scale = textLayer.clientHeight / pdfHeight;

      //querySelector('div[data-page-number="1"]');
      const ss = findNode(textLayer, r.x * scale, r.y * scale);
      //const ee = findNode(textLayer, (r.x + r.width) * scale, (r.y + r.height) * scale);
      console.log(ss);
      //console.log(ee);
      if (!ss) return;

      const range = document.createRange();
      //range.selectNode(ss.node);
      range.setStart(ss, 0);
      range.setEnd(ss, ss.length);

      if (!r.text && range.toString()) {
        r.setText(range.toString());
      }

      splitBoundaries(range);

      r._range = range;

      const spans = r.createSpans();
      r.addEventsToSpans(spans);
    };
    item.regs.forEach(checkItems);
  }

  loadFinished = (pdfHeight, pdfWidth) => {
    this.setState({
      loaded: true,
      pdfHeight: pdfHeight,
      pdfWidth: pdfWidth,
    });
  };

  componentDidUpdate() {
    this._handleUpdate();
  }

  componentDidMount() {
    this._handleUpdate();

    const ref = this.myRef;
    const settings = this.props.store.settings;
    if (ref && ref.classList && settings) {
      ref.classList.toggle("htx-line-numbers", settings.showLineNumbers);
    }
  }

  render() {
    const { item } = this.props;

    return (
      <ObjectTag item={item} style={styles} className={styles.outer}>
        <div
          ref={ref => {
            this.myRef = ref;
            item.setRef(ref);
          }}
          className={styles.block + " htx-text"}
          data-update={item._update}
          onMouseUp={this.onMouseUp.bind(this)}
        >
          <PDFView parent={this} item={item} src={item._value} ref={ref => (this.viewerRef = ref)} />
        </div>
      </ObjectTag>
    );
  }
}
// const HtxPDFView = ({ store, item }) => {
//   if (!item._value) return null;
//
//   return (
//     <ObjectTag item={item} style={styles} className={styles.outer}>
//       {item.errors?.map(error => (
//         <ErrorMessage error={error} />
//       ))}
//       <PDFView item={item} src={item._value} />
//     </ObjectTag>
//   );
// };

const HtxPDF = inject("store")(observer(HtxPDFView));
const HtxPDFPieceView = inject("store")(observer(PDFPieceView));

//const HtxPDF = inject("store")(HtxPDFView);

Registry.addTag("pdf", PDFModel, HtxPDF);
Registry.addObjectType(PDFModel);

export { PDFModel, HtxPDF };
