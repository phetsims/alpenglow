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
    // No, those "alternatives" are not actually alternatives.
    // DO NOT CHANGE {} TO Record<string, never>! It will reduce type safety for uses of this function(!)
    A extends BindingMapType = {}, // eslint-disable-line @typescript-eslint/ban-types
    B extends BindingMapType = {}, // eslint-disable-line @typescript-eslint/ban-types
    C extends BindingMapType = {}, // eslint-disable-line @typescript-eslint/ban-types
    D extends BindingMapType = {} // eslint-disable-line @typescript-eslint/ban-types
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
    ].filter( _.identity ) );
  }
}

alpenglow.register( 'PipelineLayout', PipelineLayout );
