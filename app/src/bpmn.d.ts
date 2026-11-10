declare module 'bpmn-js/lib/NavigatedViewer' {
  export default class NavigatedViewer {
    constructor(opts: { container: HTMLElement });
    importXML(xml: string): Promise<unknown>;
    get(name: string): unknown;
    destroy(): void;
  }
}
