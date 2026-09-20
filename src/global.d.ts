/// <reference types="@solidjs/start/env" />

declare module "solid-rete-plugin" {
  export class SolidPlugin<Schemes = any, T = any> {
    renderer: any;
    presets: any[];
    constructor(props?: any);
    addPreset(preset: any): void;
    setParent(scope: any): void;
  }
  export const Presets: any;
  export type SolidArea2D<Schemes = any> = any;
}
