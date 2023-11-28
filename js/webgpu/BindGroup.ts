// Copyright 2023, University of Colorado Boulder

/**
 * Wrapper for a GPUBindGroup
 *
 * Provides a "name => resource" map that can be combined and used by other tools, similar to the map of the
 * BindGroupLayout.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BindGroupLayout, Binding, DeviceContext, TypedBuffer } from '../imports.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';

export type ResourceMapType = Record<string, TypedBuffer<IntentionalAny> | GPUTextureView | null>;

type BindingMapFromResourceMap<ResourceMap extends ResourceMapType> = { [P in keyof ResourceMap]: Binding | null };

export default class BindGroup<ResourceMap extends ResourceMapType> {

  public readonly bindGroup: GPUBindGroup;

  public constructor(
    public readonly deviceContext: DeviceContext,
    public readonly name: string,
    public readonly layout: BindGroupLayout<BindingMapFromResourceMap<ResourceMap>>,
    public readonly resourceMap: ResourceMap
  ) {
    this.bindGroup = deviceContext.device.createBindGroup( {
      label: `${this.name} bind group`,
      layout: layout.layout,
      entries: Object.keys( resourceMap ).filter( name => {
        const hasBinding = layout.bindingMap[ name ] !== null;
        const hasResource = resourceMap[ name ] !== null;

        assert && assert( hasBinding === hasResource, 'Binding/resource mismatch' );
        return hasBinding && hasResource;
      } ).map( ( name: keyof ResourceMap ) => {
        const binding = layout.bindingMap[ name ]!;
        const resource = resourceMap[ name ]!;

        assert && assert( binding !== null, 'Filtered out above' );
        assert && assert( resource !== null, 'Filtered out above' );

        // TODO: should we wrap GPUTextureView? Probably not?
        return binding.getBindGroupEntry( resource instanceof TypedBuffer ? resource.buffer : resource );
      } )
    } );
  }
}

alpenglow.register( 'BindGroup', BindGroup );
