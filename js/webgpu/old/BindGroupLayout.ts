// Copyright 2023, University of Colorado Boulder

/**
 * Wrapper for a GPUBindGroupLayout.
 *
 * Provides a "name => Binding" map that can be combined and used by other tools.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, Binding, DeviceContext } from '../../imports.js';
import IntentionalAny from '../../../../phet-core/js/types/IntentionalAny.js';

// TODO: perhaps we can memoize layouts on the DeviceContext?
export default class BindGroupLayout {

  public readonly layout: GPUBindGroupLayout;

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly groupIndex: number, // TODO: consider whether to ditch this or not

    // This is a map from strings to Bindings (where null is accepted, and is treated as a "gap" for
    // conditionally-enabled things). It should include all of the bindings for the BindGroupLayout
    public readonly bindingMap: Record<string, Binding<IntentionalAny>>
  ) {
    assert && assert( Object.keys( bindingMap ).every( name => {
      const binding = bindingMap[ name ];
      return binding === null || binding.location.groupIndex === groupIndex;
    } ), 'Binding groupIndex mismatch' );

    this.layout = deviceContext.device.createBindGroupLayout( {
      label: `${name} bind group layout`,
      entries: Object.keys( bindingMap ).filter( name => bindingMap[ name ] !== null ).map( name => bindingMap[ name ]!.getBindGroupLayoutEntry() )
    } );
  }

  // // Indices generated based on the iteration order of the bindingTypeMap
  // public static createZero<BindingTypeMap extends BindingTypeMapType>(
  //   deviceContext: DeviceContext,
  //   name: string,
  //   log: boolean,
  //   bindingTypeMap: BindingTypeMap
  // ): BindGroupLayout<FirstBindingMapFromBindingTypeMap<BindingTypeMap>> {
  //   const groupIndex = 0;
  //
  //   const bindingMap: FirstBindingMapFromBindingTypeMap<BindingTypeMap> = {} as FirstBindingMapFromBindingTypeMap<BindingTypeMap>;
  //
  //   Object.keys( bindingTypeMap ).forEach( ( name, bindingIndex ) => {
  //     const bindingType = bindingTypeMap[ name ];
  //     if ( bindingType !== null ) {
  //       // @ts-expect-error Boo, not sure how to fix this
  //       bindingMap[ name as keyof BindingTypeMap ] = new Binding( bindingType, new BindingLocation( groupIndex, bindingIndex ) );
  //     }
  //   } );
  //
  //   if ( log ) {
  //     const logBinding = WGSLContext.getBoundLogBinding();
  //     if ( logBinding.location.groupIndex === groupIndex ) {
  //       bindingMap.log = logBinding;
  //     }
  //   }
  //   else {
  //     bindingMap.log = null;
  //   }
  //
  //   return new BindGroupLayout<FirstBindingMapFromBindingTypeMap<BindingTypeMap>>( deviceContext, name, groupIndex, bindingMap );
  // }
  //
  // // Indices generated based on the iteration order of the bindingTypeMap
  // public static createNonzero<BindingTypeMap extends BindingTypeMapType>(
  //   deviceContext: DeviceContext,
  //   name: string,
  //   groupIndex: number,
  //   bindingTypeMap: BindingTypeMap
  // ): BindGroupLayout<BindingMapFromBindingTypeMap<BindingTypeMap>> {
  //   const bindingMap: BindingMapFromBindingTypeMap<BindingTypeMap> = {} as BindingMapFromBindingTypeMap<BindingTypeMap>;
  //
  //   Object.keys( bindingTypeMap ).forEach( ( name, bindingIndex ) => {
  //     const bindingType = bindingTypeMap[ name ];
  //     if ( bindingType !== null ) {
  //       bindingMap[ name as keyof BindingTypeMap ] = new Binding( bindingType, new BindingLocation( groupIndex, bindingIndex ) );
  //     }
  //   } );
  //
  //   return new BindGroupLayout<BindingMapFromBindingTypeMap<BindingTypeMap>>( deviceContext, name, groupIndex, bindingMap );
  // }
}

alpenglow.register( 'BindGroupLayout', BindGroupLayout );
