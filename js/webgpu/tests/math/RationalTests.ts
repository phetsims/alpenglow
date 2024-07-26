// Copyright 2024, University of Colorado Boulder

/**
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { abs_i64WGSL, add_i64_i64WGSL, add_u32_u32_to_u64WGSL, add_u64_u64WGSL, asyncTestWithDevice, BufferArraySlot, BufferBindingType, compareArrays, ConcreteType, DirectModule, getArrayType, i32_to_i64WGSL, I32Type, is_negative_i64WGSL, is_zero_u64WGSL, left_shift_u64WGSL, mul_u32_u32_to_u64WGSL, negate_i64WGSL, Procedure, right_shift_u64WGSL, Routine, u32_to_u64WGSL, U32Type, wgsl, WGSLMainModule, WGSLSlot, WGSLString } from '../../../imports.js';
import Vector3 from '../../../../../dot/js/Vector3.js';

QUnit.module( 'RationalTests' );

// const padLeft = ( input: string, padding: string, length: number ) => {
//   let result = input;
//
//   const padLength = length - input.length;
//   for ( let i = 0; i < padLength; i++ ) {
//     result = padding + result;
//   }
//
//   return result;
// };
//
// const toU32Hex = ( n: number ) => {
//   return padLeft( n.toString( 16 ), '0', 8 );
// };
// const toU32Binary = ( n: number ) => {
//   return padLeft( n.toString( 2 ), '0', 32 );
// };

// const n16 = ( 2n ** 16n );
const n32 = ( 2n ** 32n );
// const n64 = ( 2n ** 64n );
// const n16Mask = n16 - 1n;
const n32Mask = n32 - 1n;
// const n64Mask = n64 - 1n;

const nToU32s = ( n: bigint ) => {
  return [ Number( n & n32Mask ), Number( ( n >> 32n ) & n32Mask ) ];
};

const testNumeric = (
  name: string,
  inputType: ConcreteType<number>,
  outputType: ConcreteType<number>,
  inputValues: number[],
  expectedValues: number[],
  dispatchSize: number,
  mainWgslString: WGSLString
) => {
  asyncTestWithDevice( name, async ( device, deviceContext ) => {
    const inputSlot = new BufferArraySlot( getArrayType( I32Type, inputValues.length ) );
    const outputSlot = new BufferArraySlot( getArrayType( U32Type, expectedValues.length ) );

    const module = new DirectModule<number>( {
      name: `module_${name}`,
      main: new WGSLMainModule( [
        new WGSLSlot( 'input', inputSlot, BufferBindingType.READ_ONLY_STORAGE ),
        new WGSLSlot( 'output', outputSlot, BufferBindingType.STORAGE )
      ], wgsl`
        @compute @workgroup_size(1) fn main(
          @builtin(global_invocation_id) id: vec3<u32>
        ) {
          let i = id.x;
          
          ${mainWgslString}
        }
      ` ),
      setDispatchSize: ( dispatchSize: Vector3, size: number ) => {
        dispatchSize.x = size;
      }
    } );

    const routine = await Routine.create(
      deviceContext,
      module,
      [ inputSlot, outputSlot ],
      Routine.INDIVIDUAL_LAYOUT_STRATEGY,
      ( context, execute, input: number[] ) => {
        context.setTypedBufferValue( inputSlot, input );

        execute( context, dispatchSize );

        return context.getTypedBufferValue( outputSlot );
      }
    );

    const procedure = new Procedure( routine ).bindRemainingBuffers();

    const actualValues = await procedure.standaloneExecute( deviceContext, inputValues );

    console.log( 'expected', expectedValues );
    console.log( 'actual', actualValues );

    procedure.dispose();

    return compareArrays( U32Type, inputValues, expectedValues, actualValues );
  } );
};

testNumeric( 'u32_to_u64', U32Type, U32Type, [
  0, 25, 7, 1024
], [
  ...nToU32s( 0n ),
  ...nToU32s( 25n ),
  ...nToU32s( 7n ),
  ...nToU32s( 1024n )
], 4, wgsl`
  let in = i * 1u;
  let out = i * 2u;
  let a = bitcast<u32>( input[ in ] );
  let c = ${u32_to_u64WGSL( wgsl`a` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );

testNumeric( 'i32_to_i64', I32Type, U32Type, [
  0, 25, -7, -1024
], [
  ...nToU32s( 0n ),
  ...nToU32s( 25n ),
  ...nToU32s( -7n ),
  ...nToU32s( -1024n )
], 4, wgsl`
  let in = i * 1u;
  let out = i * 2u;
  let a = bitcast<i32>( input[ in ] );
  let c = ${i32_to_i64WGSL( wgsl`a` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );

testNumeric( 'add_u32_u32_to_u64', U32Type, U32Type, [
  // 5 + 7
  5, 7,

  // 0xfffffca8 + 0x1234aef
  0xfffffca8, 0x1234aef,

  // 0x80000000 + 0x80000000
  0x80000000, 0x80000000,

  // 0xffffffff + 0x1
  0xffffffff, 0x1
], [
  ...nToU32s( 5n + 7n ),
  ...nToU32s( 0xfffffca8n + 0x1234aefn ),
  ...nToU32s( 0x80000000n + 0x80000000n ),
  ...nToU32s( 0xffffffffn + 0x1n )
], 4, wgsl`
  let in = i * 2u;
  let out = i * 2u;
  let a = bitcast<u32>( input[ in ] );
  let b = bitcast<u32>( input[ in + 1 ] );
  let c = ${add_u32_u32_to_u64WGSL( wgsl`a`, wgsl`b` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );

testNumeric( 'mul_u32_u32_to_u64', U32Type, U32Type, [
  // 5 * 7
  5, 7,

  // 0xfffffca8 * 0x1234aef
  0xfffffca8, 0x1234aef,

  // 0x80000000 * 0x80000000
  0x80000000, 0x80000000,

  // 0xffffffff * 0x1
  0xffffffff, 0x1
], [
  ...nToU32s( 5n * 7n ),
  ...nToU32s( 0xfffffca8n * 0x1234aefn ),
  ...nToU32s( 0x80000000n * 0x80000000n ),
  ...nToU32s( 0xffffffffn * 0x1n )
], 4, wgsl`
  let in = i * 2u;
  let out = i * 2u;
  let a = bitcast<u32>( input[ in ] );
  let b = bitcast<u32>( input[ in + 1 ] );
  let c = ${mul_u32_u32_to_u64WGSL( wgsl`a`, wgsl`b` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );

testNumeric( 'add_u64_u64', U32Type, U32Type, [
  // 5 + 7
  ...nToU32s( 5n ), ...nToU32s( 7n ),

  // 0xfffffca8 + 0x1234aef
  ...nToU32s( 0xfffffca8n ), ...nToU32s( 0x1234aefn ),

  // 0x18ae848a8f23a1 + 0x8a04920a8fe8c0a
  ...nToU32s( 0x18ae848a8f23a1n ), ...nToU32s( 0x8a04920a8fe8c0an )
], [
  ...nToU32s( 5n + 7n ),
  ...nToU32s( 0xfffffca8n + 0x1234aefn ),
  ...nToU32s( 0x18ae848a8f23a1n + 0x8a04920a8fe8c0an )
], 3, wgsl`
  let in = i * 4u;
  let out = i * 2u;
  let a = bitcast<vec2u>( vec2( input[ in + 0u ], input[ in + 1u ] ) );
  let b = bitcast<vec2u>( vec2( input[ in + 2u ], input[ in + 3u ] ) );
  let c = ${add_u64_u64WGSL( wgsl`a`, wgsl`b` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );

testNumeric( 'add_i64_i64', U32Type, U32Type, [
  // 5 + 7
  ...nToU32s( 5n ), ...nToU32s( -7n ),

  // 0xfffffca8 + 0x1234aef
  ...nToU32s( 0xfffffca8n ), ...nToU32s( -0x1234aefn ),

  // 0x18ae848a8f23a1 + 0x8a04920a8fe8c0a
  ...nToU32s( 0x18ae848a8f23a1n ), ...nToU32s( -0x8a04920a8fe8c0an )
], [
  ...nToU32s( 5n - 7n ),
  ...nToU32s( 0xfffffca8n - 0x1234aefn ),
  ...nToU32s( 0x18ae848a8f23a1n - 0x8a04920a8fe8c0an )
], 3, wgsl`
  let in = i * 4u;
  let out = i * 2u;
  let a = bitcast<vec2u>( vec2( input[ in + 0u ], input[ in + 1u ] ) );
  let b = bitcast<vec2u>( vec2( input[ in + 2u ], input[ in + 3u ] ) );
  let c = ${add_i64_i64WGSL( wgsl`a`, wgsl`b` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );

testNumeric( 'negate_i64', U32Type, U32Type, [
  ...nToU32s( 0n ),
  ...nToU32s( 25n ),
  ...nToU32s( -7n ),
  ...nToU32s( -1024n ),
  ...nToU32s( -0x8a04920a8fe8c0an )
], [
  ...nToU32s( -0n ),
  ...nToU32s( -25n ),
  ...nToU32s( 7n ),
  ...nToU32s( 1024n ),
  ...nToU32s( 0x8a04920a8fe8c0an )
], 5, wgsl`
  let in = i * 2u;
  let out = i * 2u;
  let a = bitcast<vec2u>( vec2( input[ in + 0u ], input[ in + 1u ] ) );
  let c = ${negate_i64WGSL( wgsl`a` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );

testNumeric( 'is_zero_u64', U32Type, U32Type, [
  ...nToU32s( 0n ),
  ...nToU32s( 25n ),
  ...nToU32s( -0n ),
  ...nToU32s( -1024n ),
  ...nToU32s( 0x100000000n )
], [
  1,
  0,
  1,
  0,
  0
], 4, wgsl`
  let in = i * 2u;
  let out = i * 1u;
  let a = bitcast<vec2u>( vec2( input[ in + 0u ], input[ in + 1u ] ) );
  let c = select( 0u, 1u, ${is_zero_u64WGSL( wgsl`a` )} );
  output[ out ] = c;
` );

testNumeric( 'is_negative_u64', U32Type, U32Type, [
  ...nToU32s( 0n ),
  ...nToU32s( 25n ),
  ...nToU32s( -7n ),
  ...nToU32s( -1024n ),
  ...nToU32s( 0x8a04920a8fe8c0an ),
  ...nToU32s( -0x8a04920a8fe8c0an )
], [
  0,
  0,
  1,
  1,
  0,
  1
], 6, wgsl`
  let in = i * 2u;
  let out = i * 1u;
  let a = bitcast<vec2u>( vec2( input[ in + 0u ], input[ in + 1u ] ) );
  let c = select( 0u, 1u, ${is_negative_i64WGSL( wgsl`a` )} );
  output[ out ] = c;
` );

testNumeric( 'abs_i64', U32Type, U32Type, [
  ...nToU32s( 0n ),
  ...nToU32s( 25n ),
  ...nToU32s( -7n ),
  ...nToU32s( -1024n ),
  ...nToU32s( -0x8a04920a8fe8c0an )
], [
  ...nToU32s( 0n ),
  ...nToU32s( 25n ),
  ...nToU32s( 7n ),
  ...nToU32s( 1024n ),
  ...nToU32s( 0x8a04920a8fe8c0an )
], 5, wgsl`
  let in = i * 2u;
  let out = i * 2u;
  let a = bitcast<vec2u>( vec2( input[ in + 0u ], input[ in + 1u ] ) );
  let c = ${abs_i64WGSL( wgsl`a` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );

testNumeric( 'left_shift_u64', U32Type, U32Type, [
  ...nToU32s( 0xf9fe432c7aca8bfan )
], [
  ...( _.range( 0, 64 ).map( n => {
    return nToU32s( 0xf9fe432c7aca8bfan << BigInt( n ) );
  } ) ).flat()
], 64, wgsl`
  let out = i * 2u;
  let a = bitcast<vec2u>( vec2( input[ 0u ], input[ 1u ] ) );
  let c = ${left_shift_u64WGSL( wgsl`a`, wgsl`i` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );

testNumeric( 'right_shift_u64', U32Type, U32Type, [
  ...nToU32s( 0xf9fe432c7aca8bfan )
], [
  ...( _.range( 0, 64 ).map( n => {
    return nToU32s( 0xf9fe432c7aca8bfan >> BigInt( n ) );
  } ) ).flat()
], 64, wgsl`
  let out = i * 2u;
  let a = bitcast<vec2u>( vec2( input[ 0u ], input[ 1u ] ) );
  let c = ${right_shift_u64WGSL( wgsl`a`, wgsl`i` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );