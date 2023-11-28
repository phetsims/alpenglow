// Copyright 2023, University of Colorado Boulder

/**
 * Wrapper for a GPUPipelineLayout.
 *
 * Provides a "name => Binding" map that is combined from the BindGroupLayouts.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindGroupLayout, Binding, DeviceContext } from '../imports.js';
import { combineOptions } from '../../../phet-core/js/optionize.js';

// TODO: perhaps we can memoize layouts on the DeviceContext?
export default class PipelineLayout<BindingMap extends Record<string, Binding | null>> {

  public readonly layout: GPUPipelineLayout;
  public readonly bindingMap: BindingMap;

  // TODO: how much typing to we want here?
  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly bindGroupLayouts: BindGroupLayout<{ [P in keyof BindingMap]: BindingMap[ P ] | never; }>[]
  ) {
    this.layout = deviceContext.device.createPipelineLayout( {
      bindGroupLayouts: bindGroupLayouts.map( bindGroupLayout => bindGroupLayout.layout )
    } );

    this.bindingMap = combineOptions<BindingMap>( {}, ...bindGroupLayouts.map( bindGroupLayout => bindGroupLayout.bindingMap ) );
  }

  public static create1<A extends Record<string, Binding | null>>(
    deviceContext: DeviceContext,
    bindGroupLayoutA: BindGroupLayout<A>
  ): PipelineLayout<A> {
    return new PipelineLayout<A>( deviceContext, [ bindGroupLayoutA ] );
  }

  public static create2<A extends Record<string, Binding | null>, B extends Record<string, Binding | null>>(
    deviceContext: DeviceContext,
    bindGroupLayoutA: BindGroupLayout<A>,
    bindGroupLayoutB: BindGroupLayout<B>
  ): PipelineLayout<A & B> {
    // @ts-expect-error - Is there a better way of getting the typing working here? This function helps inference
    return new PipelineLayout<A & B>( deviceContext, [ bindGroupLayoutA, bindGroupLayoutB ] );
  }

  public static create3<A extends Record<string, Binding | null>, B extends Record<string, Binding | null>, C extends Record<string, Binding | null>>(
    deviceContext: DeviceContext,
    bindGroupLayoutA: BindGroupLayout<A>,
    bindGroupLayoutB: BindGroupLayout<B>,
    bindGroupLayoutC: BindGroupLayout<C>
  ): PipelineLayout<A & B & C> {
    // @ts-expect-error - Is there a better way of getting the typing working here? This function helps inference
    return new PipelineLayout<A & B & C>( deviceContext, [ bindGroupLayoutA, bindGroupLayoutB, bindGroupLayoutC ] );
  }

  public static create4<A extends Record<string, Binding | null>, B extends Record<string, Binding | null>, C extends Record<string, Binding | null>, D extends Record<string, Binding | null>>(
    deviceContext: DeviceContext,
    bindGroupLayoutA: BindGroupLayout<A>,
    bindGroupLayoutB: BindGroupLayout<B>,
    bindGroupLayoutC: BindGroupLayout<C>,
    bindGroupLayoutD: BindGroupLayout<D>
  ): PipelineLayout<A & B & C & D> {
    // @ts-expect-error - Is there a better way of getting the typing working here? This function helps inference
    return new PipelineLayout<A & B & C & D>( deviceContext, [ bindGroupLayoutA, bindGroupLayoutB, bindGroupLayoutC, bindGroupLayoutD ] );
  }
}

alpenglow.register( 'PipelineLayout', PipelineLayout );
