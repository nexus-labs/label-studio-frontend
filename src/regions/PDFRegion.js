import { types } from "mobx-state-tree";

import NormalizationMixin from "../mixins/Normalization";
import RegionsMixin from "../mixins/Regions";
import SpanTextMixin from "../mixins/SpanText";
import Utils from "../utils";
import WithStatesMixin from "../mixins/WithStates";
import { PDFModel } from "../tags/object/PDF";
import { AreaMixin } from "../mixins/AreaMixin";
import Registry from "../core/Registry";

const Model = types
  .model("PDFRegionModel", {
    type: "pdfregion",
    object: types.late(() => types.reference(PDFModel)),

    x: types.number,
    y: types.number,
    width: types.number,
    height: types.number,
    page: types.number,

    text: types.string, // types.string
  })
  .views(self => ({
    get parent() {
      return self.object;
    },
    get regionElement() {
      console.log("regions.....");
      return self._spans[0];
    },
  }))
  .actions(self => ({
    beforeDestroy() {
      Utils.HTML.removeSpans(self._spans);
    },

    setText(text) {
      self.text = text;
    },

    getLabelColor() {
      let labelColor = self.parent.highlightcolor || self.style.fillcolor;

      if (labelColor) {
        labelColor = Utils.Colors.convertToRGBA(labelColor, 1.0);
      }

      return labelColor;
    },

    serialize() {
      console.log("serialize...");
      let res = {
        value: {
          // x: self.x,
          // y: self.y,
          // width: self.width,
          // height: self.height,
          // page: self.page,
        },
      };

      if (self.object.savetextresult === "yes") {
        res.value["text"] = self.text;
      }

      return res;
    },
  }));

const PDFRegionModel = types.compose(
  "PDFRegionModel",
  WithStatesMixin,
  RegionsMixin,
  AreaMixin,
  NormalizationMixin,
  SpanTextMixin,
  Model,
);

Registry.addRegionType(PDFRegionModel, "pdf");

export { PDFRegionModel };
