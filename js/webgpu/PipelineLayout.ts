// Copyright 2023, University of Colorado Boulder

/**
 * Wrapper for a GPUPipelineLayout.
 *
 * Provides a "name => Binding" map that is combined from the BindGroupLayouts.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindGroupLayout, BindingMapType, DeviceContext } from '../imports.js';
import { combineOptions } from '../../../phet-core/js/optionize.js';

// TODO: perhaps we can memoize layouts on the DeviceContext?
export default class PipelineLayout<BindingMap extends BindingMapType> {

  public readonly layout: GPUPipelineLayout;
  public readonly bindingMap: BindingMap;

  // NOTE: private so we can get nice type inference in the static constructors
  private constructor(
    public readonly deviceContext: DeviceContext,

    // TODO: get better typing here.
    public readonly bindGroupLayouts: BindGroupLayout<{ [P in keyof BindingMap]: BindingMap[ P ] | never; }>[]
  ) {
    this.layout = deviceContext.device.createPipelineLayout( {
      bindGroupLayouts: bindGroupLayouts.map( bindGroupLayout => bindGroupLayout.layout )
    } );

    this.bindingMap = combineOptions<BindingMap>( {}, ...bindGroupLayouts.map( bindGroupLayout => bindGroupLayout.bindingMap ) );
  }

  public static create<
    A extends BindingMapType = Record<string, never>,
    B extends BindingMapType = Record<string, never>,
    C extends BindingMapType = Record<string, never>,
    D extends BindingMapType = Record<string, never>
  >(
    deviceContext: DeviceContext,
    bindGroupLayoutA?: BindGroupLayout<A>,
    bindGroupLayoutB?: BindGroupLayout<B>,
    bindGroupLayoutC?: BindGroupLayout<C>,
    bindGroupLayoutD?: BindGroupLayout<D>
  ): PipelineLayout<A & B & C & D> {
    // @ts-expect-error - Is there a better way of getting the typing working here? This function helps inference
    return new PipelineLayout<A & B & C & D>( deviceContext, [
      bindGroupLayoutA,
      bindGroupLayoutB,
      bindGroupLayoutC,
      bindGroupLayoutD
    ].filter( layout => layout ) );
  }
}

alpenglow.register( 'PipelineLayout', PipelineLayout );
