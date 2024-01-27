// Copyright 2024, University of Colorado Boulder

/**
 * Responsible for recording GPU commands globally, so we can play them back later.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow } from '../imports.js';
import IntentionalAny from '../../../phet-core/js/types/IntentionalAny.js';
import arrayRemove from '../../../phet-core/js/arrayRemove.js';

export default class WebGPURecorder {

  private readonly commandLists: WebGPUCommandList[] = [];

  public start(): WebGPUCommandList {
    const commandList = new WebGPUCommandList();
    this.commandLists.push( commandList );
    return commandList;
  }

  public stop( commandList: WebGPUCommandList ): void {
    assert && assert( this.commandLists.includes( commandList ) );

    arrayRemove( this.commandLists, commandList );
  }

  private recordCommand( command: WebGPUCommand ): void {
    for ( let i = 0; i < this.commandLists.length; i++ ) {
      this.commandLists[ i ].push( command );
    }
  }

  public recordGetAdapter( result: GPUAdapter | null, options?: GPURequestAdapterOptions ): void {
    if ( this.commandLists.length ) {
      this.recordCommand( new WebGPUCommandGetAdapter( result, options ) );
    }
  }

  public recordAdapterRequestDevice( result: GPUDevice, adapter: GPUAdapter, descriptor?: GPUDeviceDescriptor ): void {
    if ( this.commandLists.length ) {
      this.recordCommand( new WebGPUCommandAdapterRequestDevice( result, adapter, descriptor ) );
    }
  }

  public recordDeviceCreateBuffer( result: GPUBuffer, device: GPUDevice, descriptor: GPUBufferDescriptor ): void {
    if ( this.commandLists.length ) {
      this.recordCommand( new WebGPUCommandDeviceCreateBuffer( result, device, descriptor ) );
    }
  }

  public recordDeviceCreateQuerySet( result: GPUQuerySet, device: GPUDevice, descriptor: GPUQuerySetDescriptor ): void {
    if ( this.commandLists.length ) {
      this.recordCommand( new WebGPUCommandDeviceCreateQuerySet( result, device, descriptor ) );
    }
  }

  public recordDeviceCreateBindGroupLayout( result: GPUBindGroupLayout, device: GPUDevice, descriptor: GPUBindGroupLayoutDescriptor ): void {
    if ( this.commandLists.length ) {
      this.recordCommand( new WebGPUCommandDeviceCreateBindGroupLayout( result, device, descriptor ) );
    }
  }

  public recordDeviceCreatePipelineLayout( result: GPUPipelineLayout, device: GPUDevice, descriptor: GPUPipelineLayoutDescriptor ): void {
    if ( this.commandLists.length ) {
      this.recordCommand( new WebGPUCommandDeviceCreatePipelineLayout( result, device, descriptor ) );
    }
  }

  public recordDeviceCreateShaderModule( result: GPUShaderModule, device: GPUDevice, descriptor: GPUShaderModuleDescriptor ): void {
    if ( this.commandLists.length ) {
      this.recordCommand( new WebGPUCommandDeviceCreateShaderModule( result, device, descriptor ) );
    }
  }

  public recordDeviceCreateComputePipeline( result: GPUComputePipeline, device: GPUDevice, descriptor: GPUComputePipelineDescriptor, async: boolean ): void {
    if ( this.commandLists.length ) {
      this.recordCommand( new WebGPUCommandDeviceCreateComputePipeline( result, device, descriptor, async ) );
    }
  }

  public recordDeviceCreateBindGroup( result: GPUBindGroup, device: GPUDevice, descriptor: GPUBindGroupDescriptor ): void {
    if ( this.commandLists.length ) {
      this.recordCommand( new WebGPUCommandDeviceCreateBindGroup( result, device, descriptor ) );
    }
  }

  public recordDeviceCreateCommandEncoder( result: GPUCommandEncoder, device: GPUDevice, descriptor?: GPUCommandEncoderDescriptor ): void {
    if ( this.commandLists.length ) {
      this.recordCommand( new WebGPUCommandDeviceCreateCommandEncoder( result, device, descriptor ) );
    }
  }

  public static getNamePrefix( obj: IntentionalAny ): string {
    if ( obj instanceof GPUDevice ) {
      return 'device';
    }
    else if ( obj instanceof GPUAdapter ) {
      return 'adapter';
    }
    else if ( obj instanceof GPUBuffer ) {
      return 'buffer';
    }
    else if ( obj instanceof GPUQuerySet ) {
      return 'querySet';
    }
    else if ( obj instanceof GPUShaderModule ) {
      return 'shaderModule';
    }
    else if ( obj instanceof GPUComputePipeline ) {
      return 'computePipeline';
    }
    else if ( obj instanceof GPUBindGroup ) {
      return 'bindGroup';
    }
    else if ( obj instanceof GPUBindGroupLayout ) {
      return 'bindGroupLayout';
    }
    else if ( obj instanceof GPUPipelineLayout ) {
      return 'pipelineLayout';
    }
    else if ( obj instanceof GPUCommandEncoder ) {
      return 'commandEncoder';
    }
    else if ( obj instanceof GPURenderPassEncoder ) {
      return 'renderPassEncoder';
    }
    else if ( obj instanceof GPUComputePassEncoder ) {
      return 'computePassEncoder';
    }
    else if ( obj instanceof GPUTextureView ) {
      return 'textureView';
    }
    else if ( obj instanceof GPUSampler ) {
      return 'sampler';
    }
    else if ( obj instanceof GPUExternalTexture ) {
      return 'externalTexture';
    }
    else {
      throw new Error( 'add the name' );
    }
  }

  public static createNameMap( objects: IntentionalAny[] ): Map<IntentionalAny, string> {
    objects = _.uniq( objects );

    const prefixTotalCountMap = new Map<string, number>();
    objects.forEach( obj => {
      const prefix = WebGPURecorder.getNamePrefix( obj );
      const count = prefixTotalCountMap.get( prefix ) || 0;
      prefixTotalCountMap.set( prefix, count + 1 );
    } );

    const map = new Map<IntentionalAny, string>();
    const prefixCountMap = new Map<string, number>();
    objects.forEach( obj => {
      const prefix = WebGPURecorder.getNamePrefix( obj );

      const hasMultiples = prefixTotalCountMap.get( prefix )! > 1;
      if ( hasMultiples ) {
        const number = prefixCountMap.get( prefix ) || 0;
        prefixCountMap.set( prefix, number + 1 );
        map.set( obj, `${prefix}${number}` );
      }
      else {
        map.set( obj, prefix );
      }
    } );

    return map;
  }

  // TODO: consider how we're handling this
  public static arrayBufferLikeString( data: ArrayBufferLike ): string {
    return `new Uint8Array( [ ${new Uint8Array( data ).join( ', ' )} ] ).buffer`;
  }

  public static objectToString(
    level: number,
    map: Record<string, string | undefined>
  ): string {
    const definedKeys = Object.keys( map ).filter( key => map[ key ] !== undefined );

    if ( definedKeys.length === 0 ) {
      return '{}';
    }
    else if ( definedKeys.length === 1 ) {
      return `{ ${definedKeys[ 0 ]}: ${map[ definedKeys[ 0 ] ]} }`;
    }
    else {
      return `{\n${definedKeys.map( key => `${'  '.repeat( level + 1 )}${key}: ${map[ key ]}` ).join( ',\n' )}\n${'  '.repeat( level )}}`;
    }
  }

  public static rawValue(
    level: number,
    value: IntentionalAny,
    nameMap?: Map<IntentionalAny, string>,
    objectOverrides?: Record<string, ( value: IntentionalAny ) => string>
  ): string | undefined {
    if ( nameMap && nameMap.has( value ) ) {
      return nameMap.get( value );
    }
    else if ( typeof value === 'number' ) {
      return `${value}`;
    }
    else if ( typeof value === 'string' ) {
      if ( value.includes( '\n' ) ) {
        return `\`${value.replace( /`/g, '\\`' )}\``;
      }
      else {
        return `'${value.replace( /'/g, '\\\'' )}'`;
      }
    }
    else if ( value === undefined ) {
      return undefined;
    }
    else if ( value === null ) {
      return 'null';
    }
    else if ( Array.isArray( value ) ) {
      if ( value.length === 0 ) {
        return '[]';
      }
      else if ( value.length === 1 ) {
        return `[ ${WebGPURecorder.rawValue( level, value[ 0 ], nameMap )} ]`;
      }
      else {
        const getValue = ( item: IntentionalAny ) => {
          if ( objectOverrides && objectOverrides.arrayElement ) {
            return objectOverrides.arrayElement( item );
          }
          else {
            return WebGPURecorder.rawValue( level + 1, item, nameMap );
          }
        };
        return `[\n${value.map( item => `${'  '.repeat( level + 1 )}${getValue( item )}` ).join( ',\n' )}\n${'  '.repeat( level )}]`;
      }
    }
    else {
      const map: Record<string, string | undefined > = {};
      Object.keys( value ).forEach( key => {
        if ( objectOverrides && objectOverrides[ key ] ) {
          map[ key ] = objectOverrides[ key ]!( value[ key ] );
        }
        else {
          map[ key ] = WebGPURecorder.rawValue( level + 1, value[ key ], nameMap );
        }
      } );

      return WebGPURecorder.objectToString( level, map );
    }
  }

  public static bitfieldToString( bitfield: number, nameMap: Map<number, string> ): string {
    const usedNames: string[] = [];

    nameMap.forEach( ( name, value ) => {
      if ( bitfield & value ) {
        usedNames.push( name );
        bitfield ^= value;
      }
    } );

    assert && assert( bitfield === 0, 'bitfield should be empty' );

    if ( usedNames.length === 0 ) {
      return '0';
    }
    else {
      return usedNames.join( ' | ' );
    }
  }
}
alpenglow.register( 'WebGPURecorder', WebGPURecorder );

export class WebGPUCommandList {

  public constructor(
    public readonly commands: WebGPUCommand[] = []
  ) {}

  public push( command: WebGPUCommand ): void {
    this.commands.push( command );
  }

  public getDeclaredObjects(): IntentionalAny[] {
    const objects: IntentionalAny[] = [];
    this.commands.forEach( command => {
      if ( command.result ) {
        objects.push( command.result );
      }
    } );
    return objects;
  }

  public getUnboundObjects( declaredObjects: IntentionalAny[] = this.getDeclaredObjects() ): IntentionalAny[] {
    const objects: IntentionalAny[] = [];

    this.commands.forEach( command => {
      command.dependencies.forEach( dependency => {
        if ( !declaredObjects.includes( dependency ) ) {
          objects.push( dependency );
        }
      } );
    } );

    return _.uniq( objects );
  }

  public getObjects(): IntentionalAny[] {
    const declaredObjects = this.getDeclaredObjects();
    const unboundObjects = this.getUnboundObjects( declaredObjects );

    // uniq for sanity check
    return _.uniq( [ ...unboundObjects, ...declaredObjects ] );
  }

  public getNameMap(): Map<IntentionalAny, string> {
    return WebGPURecorder.createNameMap( this.getObjects() );
  }

  public toJS( nameMap: Map<IntentionalAny, string> = this.getNameMap(), level = 0 ): string {
    return this.commands.map( command => `${'  '.repeat( level )}${command.toJS( nameMap, level )}` ).join( '\n' );
  }

  public toJSClosure( nameMap: Map<IntentionalAny, string> = this.getNameMap(), level = 0 ): string {
    const unboundObjects = this.getUnboundObjects();

    return `async (${unboundObjects.length ? ` ${unboundObjects.map( unboundObject => {
      return `${nameMap.get( unboundObject )!}: ${unboundObject.constructor.name}`;
    } ).join( ', ' )} ` : ''}) => {\n${this.toJS( nameMap, level + 1 )}\n}`;
  }
}
alpenglow.register( 'WebGPUCommandList', WebGPUCommandList );

const getName = ( nameMap: Map<IntentionalAny, string>, obj: IntentionalAny ): string => {
  const name = nameMap.get( obj );

  assert && assert( name );
  return name!;
};

export abstract class WebGPUCommand {
  public constructor(
    public readonly result: IntentionalAny | null,
    public readonly dependencies: IntentionalAny[]
  ) {}

  public abstract toJS( nameMap: Map<IntentionalAny, string>, level?: number ): string;

  protected getDeclaration( nameMap: Map<IntentionalAny, string> ): string {
    if ( this.result !== null ) {
      return `const ${getName( nameMap, this.result )} = `;
    }
    else {
      return '';
    }
  }
}
alpenglow.register( 'WebGPUCommand', WebGPUCommand );

class WebGPUCommandGetAdapter extends WebGPUCommand {
  public constructor(
    result: GPUAdapter | null,
    public readonly options?: GPURequestAdapterOptions
  ) {
    super( result, [] );
  }

  public toJS( nameMap: Map<IntentionalAny, string>, level = 0 ): string {
    return `${this.getDeclaration( nameMap )}await navigator.gpu?.requestAdapter(${this.options ? ` ${WebGPURecorder.rawValue( level, this.options, nameMap )} ` : ''});`;
  }
}

class WebGPUCommandAdapterRequestDevice extends WebGPUCommand {
  public constructor(
    result: GPUDevice,
    public readonly adapter: GPUAdapter,
    public readonly descriptor?: GPUDeviceDescriptor
  ) {
    super( result, [] );
  }

  public toJS( nameMap: Map<IntentionalAny, string>, level = 0 ): string {
    return `${this.getDeclaration( nameMap )}${getName( nameMap, this.adapter )}.requestDevice(${this.descriptor ? ` ${WebGPURecorder.rawValue( level, this.descriptor, nameMap )} ` : ''});`;
  }
}

class WebGPUCommandDeviceCreateBuffer extends WebGPUCommand {
  public constructor(
    result: GPUBuffer,
    public readonly device: GPUDevice,
    public readonly descriptor: GPUBufferDescriptor
  ) {
    super( result, [ device ] );
  }

  public toJS( nameMap: Map<IntentionalAny, string>, level = 0 ): string {
    const deviceName = nameMap.get( this.device )!;
    assert && assert( deviceName );

    return `${this.getDeclaration( nameMap )}${deviceName}.createBuffer( ${WebGPURecorder.rawValue( level, this.descriptor, nameMap, {
      usage: ( value: IntentionalAny ) => {
        const numberValue = value as number;
        // eslint-disable-next-line no-simple-type-checking-assertions
        assert && assert( typeof value === 'number' );
        
        return WebGPURecorder.bitfieldToString( numberValue, new Map<number, string>( [
          [ GPUBufferUsage.MAP_READ, 'GPUBufferUsage.MAP_READ' ],
          [ GPUBufferUsage.MAP_WRITE, 'GPUBufferUsage.MAP_WRITE' ],
          [ GPUBufferUsage.COPY_SRC, 'GPUBufferUsage.COPY_SRC' ],
          [ GPUBufferUsage.COPY_DST, 'GPUBufferUsage.COPY_DST' ],
          [ GPUBufferUsage.INDEX, 'GPUBufferUsage.INDEX' ],
          [ GPUBufferUsage.VERTEX, 'GPUBufferUsage.VERTEX' ],
          [ GPUBufferUsage.UNIFORM, 'GPUBufferUsage.UNIFORM' ],
          [ GPUBufferUsage.STORAGE, 'GPUBufferUsage.STORAGE' ],
          [ GPUBufferUsage.INDIRECT, 'GPUBufferUsage.INDIRECT' ],
          [ GPUBufferUsage.QUERY_RESOLVE, 'GPUBufferUsage.QUERY_RESOLVE' ]
        ] ) );
      }
    } )} );`;
  }
}

class WebGPUCommandDeviceCreateQuerySet extends WebGPUCommand {
  public constructor(
    result: GPUQuerySet,
    public readonly device: GPUDevice,
    public readonly descriptor: GPUQuerySetDescriptor
  ) {
    super( result, [ device ] );
  }

  public toJS( nameMap: Map<IntentionalAny, string>, level = 0 ): string {
    const deviceName = nameMap.get( this.device )!;
    assert && assert( deviceName );

    return `${this.getDeclaration( nameMap )}${deviceName}.createQuerySet( ${WebGPURecorder.rawValue( level, this.descriptor, nameMap )} );`;
  }
}

class WebGPUCommandDeviceCreateBindGroupLayout extends WebGPUCommand {
  public constructor(
    result: GPUBindGroupLayout,
    public readonly device: GPUDevice,
    public readonly descriptor: GPUBindGroupLayoutDescriptor
  ) {
    super( result, [ device ] );
  }

  public toJS( nameMap: Map<IntentionalAny, string>, level = 0 ): string {
    const deviceName = nameMap.get( this.device )!;
    assert && assert( deviceName );

    return `${this.getDeclaration( nameMap )}${deviceName}.createBindGroupLayout( ${WebGPURecorder.rawValue( level, this.descriptor, nameMap, {
      entries: ( value: IntentionalAny ) => {
        return WebGPURecorder.rawValue( level + 1, value, nameMap, {
          arrayElement: ( value: IntentionalAny ) => {
            return WebGPURecorder.rawValue( level + 2, value, nameMap, {
              visibility: ( value: IntentionalAny ) => WebGPURecorder.bitfieldToString( value as number, new Map<number, string>( [
                [ GPUShaderStage.VERTEX, 'GPUShaderStage.VERTEX' ],
                [ GPUShaderStage.FRAGMENT, 'GPUShaderStage.FRAGMENT' ],
                [ GPUShaderStage.COMPUTE, 'GPUShaderStage.COMPUTE' ]
              ] ) )
            } )!;
          }
        } )!;
      }
    } )} );`;
  }
}

class WebGPUCommandDeviceCreatePipelineLayout extends WebGPUCommand {
  public constructor(
    result: GPUPipelineLayout,
    public readonly device: GPUDevice,
    public readonly descriptor: GPUPipelineLayoutDescriptor
  ) {
    super( result, [ device, ...descriptor.bindGroupLayouts ] );
  }

  public toJS( nameMap: Map<IntentionalAny, string>, level = 0 ): string {
    const deviceName = nameMap.get( this.device )!;
    assert && assert( deviceName );

    return `${this.getDeclaration( nameMap )}${deviceName}.createPipelineLayout( ${WebGPURecorder.rawValue( level, this.descriptor, nameMap )} );`;
  }
}

class WebGPUCommandDeviceCreateShaderModule extends WebGPUCommand {
  public constructor(
    result: GPUShaderModule,
    public readonly device: GPUDevice,
    public readonly descriptor: GPUShaderModuleDescriptor
  ) {
    const compilationHintLayouts = descriptor.compilationHints ? descriptor.compilationHints.map( hint => hint.layout ).filter( hint => hint && hint !== 'auto' ) : [];
    super( result, [ device, ...compilationHintLayouts ] );
  }

  public toJS( nameMap: Map<IntentionalAny, string>, level = 0 ): string {
    const deviceName = nameMap.get( this.device )!;
    assert && assert( deviceName );

    return `${this.getDeclaration( nameMap )}${deviceName}.createShaderModule( ${WebGPURecorder.rawValue( level, this.descriptor, nameMap )} );`;
  }
}

class WebGPUCommandDeviceCreateComputePipeline extends WebGPUCommand {
  public constructor(
    result: GPUComputePipeline,
    public readonly device: GPUDevice,
    public readonly descriptor: GPUComputePipelineDescriptor,
    public readonly async: boolean
  ) {
    const module = descriptor.compute.module;
    const layout = descriptor.layout;

    super( result, [ device, module, ...( layout === 'auto' ? [] : [ layout ] ) ] );
  }

  public toJS( nameMap: Map<IntentionalAny, string>, level = 0 ): string {
    const deviceName = nameMap.get( this.device )!;
    assert && assert( deviceName );

    return `${this.getDeclaration( nameMap )}${this.async ? 'await ' : ''}${deviceName}.createComputePipeline${this.async ? 'Async' : ''}( ${WebGPURecorder.rawValue( level, this.descriptor, nameMap )} );`;
  }
}

class WebGPUCommandDeviceCreateBindGroup extends WebGPUCommand {
  public constructor(
    result: GPUBindGroup,
    public readonly device: GPUDevice,
    public readonly descriptor: GPUBindGroupDescriptor
  ) {
    const resources = [ ...descriptor.entries ].map( entry => {
      const resource = entry.resource;

      if ( resource instanceof GPUSampler || resource instanceof GPUTextureView || resource instanceof GPUExternalTexture ) {
        return resource;
      }
      else {
        return resource.buffer;
      }
    } );
    super( result, [ device, descriptor.layout, ...resources ] );
  }

  public toJS( nameMap: Map<IntentionalAny, string>, level = 0 ): string {
    const deviceName = nameMap.get( this.device )!;
    assert && assert( deviceName );

    return `${this.getDeclaration( nameMap )}${deviceName}.createBindGroup( ${WebGPURecorder.rawValue( level, this.descriptor, nameMap )} );`;
  }
}

class WebGPUCommandDeviceCreateCommandEncoder extends WebGPUCommand {
  public constructor(
    result: GPUCommandEncoder,
    public readonly device: GPUDevice,
    public readonly descriptor?: GPUCommandEncoderDescriptor
  ) {
    super( result, [ device ] );
  }

  public toJS( nameMap: Map<IntentionalAny, string>, level = 0 ): string {
    const deviceName = nameMap.get( this.device )!;
    assert && assert( deviceName );

    return `${this.getDeclaration( nameMap )}${deviceName}.createCommandEncoder(${this.descriptor ? ` ${WebGPURecorder.rawValue( level, this.descriptor, nameMap )} ` : ''});`;
  }
}
