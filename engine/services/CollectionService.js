import { Signal } from '../core/signal.js';

export default class CollectionService {
  constructor() {
    this.tagMap = new Map(); // tag -> Set(instances)
    this.addedSignals = new Map();
    this.removedSignals = new Map();

    this._getTagSet = tag => {
      if (!this.tagMap.has(tag)) {
        this.tagMap.set(tag, new Set());
      }
      return this.tagMap.get(tag);
    };

    this._getSignal = (map, tag) => {
      if (!map.has(tag)) {
        map.set(tag, new Signal());
      }
      return map.get(tag);
    };

    this.AddTag = (instance, tag) => {
      if (!instance.__collectionTags) {
        instance.__collectionTags = new Set();
        instance.__collectionConnection = instance.AncestryChanged.Connect((inst, parent) => {
          if (parent === null) {
            for (const t of [...instance.__collectionTags]) {
              this.RemoveTag(instance, t);
            }
          }
        });
      }
      if (instance.__collectionTags.has(tag)) return;

      instance.__collectionTags.add(tag);
      this._getTagSet(tag).add(instance);
      const added = this.addedSignals.get(tag);
      if (added) added.Fire(instance);
    };

    this.RemoveTag = (instance, tag) => {
      if (!instance.__collectionTags || !instance.__collectionTags.has(tag)) return;

      instance.__collectionTags.delete(tag);
      const tagSet = this.tagMap.get(tag);
      if (tagSet) {
        tagSet.delete(instance);
        if (tagSet.size === 0) this.tagMap.delete(tag);
      }
      const removed = this.removedSignals.get(tag);
      if (removed) removed.Fire(instance);

      if (instance.__collectionTags.size === 0) {
        if (instance.__collectionConnection) {
          instance.__collectionConnection.Disconnect();
        }
        delete instance.__collectionTags;
        delete instance.__collectionConnection;
      }
    };

    this.HasTag = (instance, tag) => {
      return !!(instance.__collectionTags && instance.__collectionTags.has(tag));
    };

    this.GetTags = instance => {
      return instance.__collectionTags ? Array.from(instance.__collectionTags) : [];
    };

    this.GetTagged = tag => {
      const tagSet = this.tagMap.get(tag);
      return tagSet ? Array.from(tagSet) : [];
    };

    this.GetInstanceAddedSignal = tag => {
      return this._getSignal(this.addedSignals, tag);
    };

    this.GetInstanceRemovedSignal = tag => {
      return this._getSignal(this.removedSignals, tag);
    };
  }
}
