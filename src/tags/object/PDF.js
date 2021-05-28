import React, { Component } from "react";
import { observer, inject } from "mobx-react";
import { types, getRoot, getType } from "mobx-state-tree";

import ObjectBase from "./Base";
import ProcessAttrsMixin from "../../mixins/ProcessAttrs";
import ObjectTag from "../../components/Tags/Object";
import Registry from "../../core/Registry";
import { ErrorMessage } from "../../components/ErrorMessage/ErrorMessage";
import { parseValue } from "../../utils/data";
import { HyperTextRegionModel } from "../../regions";
import { restoreNewsnapshot } from "../../core/Helpers";
import RegionsMixin from "../../mixins/Regions";
import * as xpath from "xpath-range";
import { splitBoundaries } from "../../utils/html";
import Utils from "../../utils";
import { HyperTextModel } from "./HyperText";
import PDFView from "../../components/PDFView/PDFView";
import Waveform from "../../components/Waveform/Waveform";
import AudioControls from "./Audio/Controls";

import styles from "./PDF/PDF.module.scss";

const TagAttrs = types.model({
  name: types.identifier,
  value: types.maybeNull(types.string),
});

const Model = types
  .model({
    type: "pdf",
    _value: types.optional(types.string, ""),
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
      return states
        ? states.filter(
            s => s.isSelected && (getType(s).name === "PDFLabelsModel" || getType(s).name === "RatingModel"),
          )
        : null;
    },
  }))
  .actions(self => ({
    needsUpdate() {
      self._update = self._update + 1;
    },

    updateValue(store) {
      self._value = parseValue(self.value, store.task.dataObj);
    },

    createRegion(p) {
      const r = HyperTextRegionModel.create({
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
    },
  }));

const PDFModel = types.compose("PDFModel", TagAttrs, Model, ProcessAttrsMixin, ObjectBase);

const HtxPDFView = ({ store, item }) => {
  if (!item._value) return null;

  return (
    <ObjectTag item={item} style={styles} className={styles.outer}>
      {item.errors?.map(error => (
        <ErrorMessage error={error} />
      ))}
      <PDFView src={item._value} />
    </ObjectTag>
  );
};

const HtxPDF = inject("store")(HtxPDFView);

Registry.addTag("pdf", PDFModel, HtxPDF);
Registry.addObjectType(PDFModel);

export { PDFModel, HtxPDF };
