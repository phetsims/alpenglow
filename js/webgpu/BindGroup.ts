// Copyright 2023, University of Colorado Boulder

/**
 * Wrapper for a GPUBindGroup
 *
 * Provides a "name => resource" map that can be combined and used by other tools, similar to the map of the
 * BindGroupLayout.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindGroupLayout, DeviceContext, TypedBuffer } from '../imports.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';

export default class BindGroup {

  public readonly bindGroup: GPUBindGroup;

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly layout: BindGroupLayout,
    public readonly resourceMap: Record<string, TypedBuffer<IntentionalAny> | GPUTextureView>
  ) {
    this.bindGroup = deviceContext.device.createBindGroup( {
      label: `${this.name} bind group`,
      layout: layout.layout,
      entries: Object.keys( resourceMap ).filter( name => {
        const hasBinding = layout.bindingMap[ name ] !== null;
        const hasResource = resourceMap[ name ] !== null;

        assert && assert( hasBinding === hasResource, 'Binding/resource mismatch' );
        return hasBinding && hasResource;
      } ).map( name => {
        const binding = layout.bindingMap[ name ]!;
        const resource = resourceMap[ name ]!;

        assert && assert( binding !== null, 'Filtered out above' );
        assert && assert( resource !== null, 'Filtered out above' );

        // TODO: should we wrap GPUTextureView? Probably not?
        return binding.getBindGroupEntry( resource instanceof TypedBuffer ? resource.buffer : resource );
      } )
    } );
  }

  // // TODO: why is this... losing the type information?
  // public static createZero<ResourceMap extends ResourceMapTypeWithLog>(
  //   deviceContext: DeviceContext,
  //   name: string,
  //   layout: BindGroupLayout<BindingMapFromResourceMap<ResourceMap>>,
  //   log: boolean,
  //   resourceMap: StrictOmit<ResourceMap, 'log'>
  // ): BindGroup<ResourceMap> {
  //   // @ts-expect-error
  //   return new BindGroup<ResourceMap>( deviceContext, name, layout, {
  //     // eslint-disable-next-line no-object-spread-on-non-literals
  //     ...resourceMap,
  //     log: log ? deviceContext.getLogTypedBuffer() : null
  //   } );
  // }
}

alpenglow.register( 'BindGroup', BindGroup );
