// Copyright 2024-2025, University of Colorado Boulder

/**
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import Vector3 from '../../../../../dot/js/Vector3.js';
import { ConcreteType, getArrayType, I32Type, U32Type } from '../../compute/ConcreteType.js';
import { asyncTestWithDevice, compareArrays } from '../ShaderTestUtils.js';
import { wgsl, WGSLMainModule, WGSLSlot, WGSLString } from '../../wgsl/WGSLString.js';
import { BufferArraySlot } from '../../compute/BufferArraySlot.js';
import { DirectModule } from '../../compute/DirectModule.js';
import { BufferBindingType } from '../../compute/BufferBindingType.js';
import { Routine } from '../../compute/Routine.js';
import { Procedure } from '../../compute/Procedure.js';
import { u32_to_u64WGSL } from '../../wgsl/math/u32_to_u64WGSL.js';
import { i32_to_i64WGSL } from '../../wgsl/math/i32_to_i64WGSL.js';
import { add_u32_u32_to_u64WGSL } from '../../wgsl/math/add_u32_u32_to_u64WGSL.js';
import { mul_u32_u32_to_u64WGSL } from '../../wgsl/math/mul_u32_u32_to_u64WGSL.js';
import { add_u64_u64WGSL } from '../../wgsl/math/add_u64_u64WGSL.js';
import { add_i64_i64WGSL } from '../../wgsl/math/add_i64_i64WGSL.js';
import { negate_i64WGSL } from '../../wgsl/math/negate_i64WGSL.js';
import { is_zero_u64WGSL } from '../../wgsl/math/is_zero_u64WGSL.js';
import { is_negative_i64WGSL } from '../../wgsl/math/is_negative_i64WGSL.js';
import { abs_i64WGSL } from '../../wgsl/math/abs_i64WGSL.js';
import { left_shift_u64WGSL } from '../../wgsl/math/left_shift_u64WGSL.js';
import { right_shift_u64WGSL } from '../../wgsl/math/right_shift_u64WGSL.js';
import { first_leading_bit_u64WGSL } from '../../wgsl/math/first_leading_bit_u64WGSL.js';
import { first_trailing_bit_u64WGSL } from '../../wgsl/math/first_trailing_bit_u64WGSL.js';
import { subtract_i64_i64WGSL } from '../../wgsl/math/subtract_i64_i64WGSL.js';
import { cmp_u64_u64WGSL } from '../../wgsl/math/cmp_u64_u64WGSL.js';
import { cmp_i64_i64WGSL } from '../../wgsl/math/cmp_i64_i64WGSL.js';
import { mul_u64_u64WGSL } from '../../wgsl/math/mul_u64_u64WGSL.js';
import { mul_i64_i64WGSL } from '../../wgsl/math/mul_i64_i64WGSL.js';
import { div_u64_u64WGSL } from '../../wgsl/math/div_u64_u64WGSL.js';
import { gcd_u64_u64WGSL } from '../../wgsl/math/gcd_u64_u64WGSL.js';
import { i64_to_q128WGSL } from '../../wgsl/math/i64_to_q128WGSL.js';
import { whole_i64_to_q128WGSL } from '../../wgsl/math/whole_i64_to_q128WGSL.js';
import { equals_cross_mul_q128WGSL } from '../../wgsl/math/equals_cross_mul_q128WGSL.js';
import { ratio_test_q128WGSL } from '../../wgsl/math/ratio_test_q128WGSL.js';
import { reduce_q128WGSL } from '../../wgsl/math/reduce_q128WGSL.js';
import { intersect_line_segmentsWGSL } from '../../wgsl/math/intersect_line_segmentsWGSL.js';

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
    const inputSlot = new BufferArraySlot( getArrayType( inputType, inputValues.length ) );
    const outputSlot = new BufferArraySlot( getArrayType( outputType, expectedValues.length ) );

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
  let a = input[ in ];
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
  let a = input[ in ];
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
  let a = input[ in ];
  let b = input[ in + 1 ];
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
  let a = input[ in ];
  let b = input[ in + 1 ];
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
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
  let b = vec2( input[ in + 2u ], input[ in + 3u ] );
  let c = ${add_u64_u64WGSL( wgsl`a`, wgsl`b` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );

testNumeric( 'add_i64_i64', U32Type, U32Type, [
  // 5 + -7
  ...nToU32s( 5n ), ...nToU32s( -7n ),

  // 0xfffffca8 + -0x1234aef
  ...nToU32s( 0xfffffca8n ), ...nToU32s( -0x1234aefn ),

  // 0x18ae848a8f23a1 + -0x8a04920a8fe8c0a
  ...nToU32s( 0x18ae848a8f23a1n ), ...nToU32s( -0x8a04920a8fe8c0an )
], [
  ...nToU32s( 5n - 7n ),
  ...nToU32s( 0xfffffca8n - 0x1234aefn ),
  ...nToU32s( 0x18ae848a8f23a1n - 0x8a04920a8fe8c0an )
], 3, wgsl`
  let in = i * 4u;
  let out = i * 2u;
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
  let b = vec2( input[ in + 2u ], input[ in + 3u ] );
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
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
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
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
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
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
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
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
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
  let a = vec2( input[ 0u ], input[ 1u ] );
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
  let a = vec2( input[ 0u ], input[ 1u ] );
  let c = ${right_shift_u64WGSL( wgsl`a`, wgsl`i` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );

testNumeric( 'first_leading_bit_u64', U32Type, U32Type, [
  ...nToU32s( 1n ),
  ...nToU32s( 7n ),
  ...nToU32s( 0xf9fe432c7aca8bfan ),
  ...nToU32s( 0x8a04920a8fe8c0an ),
  ...nToU32s( 0x8000000000000000n )
], [
  0,
  2,
  63,
  59,
  63
], 5, wgsl`
  let in = i * 2u;
  let out = i * 1u;
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
  let c = ${first_leading_bit_u64WGSL( wgsl`a` )};
  output[ out ] = c;
` );

testNumeric( 'first_trailing_bit_u64', U32Type, U32Type, [
  ...nToU32s( 1n ),
  ...nToU32s( 8n ),
  ...nToU32s( 0xf9fe432c7aca8bfan ),
  ...nToU32s( 0x8a04920a8fe8c0an ),
  ...nToU32s( 0x8000000000000000n )
], [
  0,
  3,
  1,
  1,
  63
], 5, wgsl`
  let in = i * 2u;
  let out = i * 1u;
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
  let c = ${first_trailing_bit_u64WGSL( wgsl`a` )};
  output[ out ] = c;
` );

testNumeric( 'subtract_i64_i64', U32Type, U32Type, [
  // 5 - 7
  ...nToU32s( 5n ), ...nToU32s( 7n ),

  // 0xfffffca8 - 0x1234aef
  ...nToU32s( 0xfffffca8n ), ...nToU32s( 0x1234aefn ),

  // 0x18ae848a8f23a1 - 0x8a04920a8fe8c0a
  ...nToU32s( 0x18ae848a8f23a1n ), ...nToU32s( 0x8a04920a8fe8c0an ),

  // 0x18ae848a8f23a1 - 0x18ae848a8f23a1 (the same)
  ...nToU32s( 0x18ae848a8f23a1n ), ...nToU32s( 0x18ae848a8f23a1n )
], [
  ...nToU32s( 5n - 7n ),
  ...nToU32s( 0xfffffca8n - 0x1234aefn ),
  ...nToU32s( 0x18ae848a8f23a1n - 0x8a04920a8fe8c0an ),
  ...nToU32s( 0n )
], 4, wgsl`
  let in = i * 4u;
  let out = i * 2u;
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
  let b = vec2( input[ in + 2u ], input[ in + 3u ] );
  let c = ${subtract_i64_i64WGSL( wgsl`a`, wgsl`b` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );

testNumeric( 'cmp_u64_u64', U32Type, I32Type, [
  // 5 ? 7
  ...nToU32s( 5n ), ...nToU32s( 7n ),

  // 0xfffffca8 ? 0x1234aef
  ...nToU32s( 0xfffffca8n ), ...nToU32s( 0x1234aefn ),

  // 0x18ae848a8f23a1 ? 0x8a04920a8fe8c0a
  ...nToU32s( 0x18ae848a8f23a1n ), ...nToU32s( 0x8a04920a8fe8c0an ),

  // 0x18ae848a8f23a1 ? 0x18ae848a8f23a1 (the same)
  ...nToU32s( 0x18ae848a8f23a1n ), ...nToU32s( 0x18ae848a8f23a1n )
], [
  -1,
  1,
  -1,
  0
], 4, wgsl`
  let in = i * 4u;
  let out = i * 1u;
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
  let b = vec2( input[ in + 2u ], input[ in + 3u ] );
  let c = ${cmp_u64_u64WGSL( wgsl`a`, wgsl`b` )};
  output[ out + 0u ] = c;
` );

testNumeric( 'cmp_i64_i64', U32Type, I32Type, [
  // 5 ? 7
  ...nToU32s( 5n ), ...nToU32s( 7n ),

  // 0xfffffca8 ? 0x1234aef
  ...nToU32s( 0xfffffca8n ), ...nToU32s( 0x1234aefn ),

  // 0x18ae848a8f23a1 ? 0x2a04920a8fe8c0a
  ...nToU32s( 0x18ae848a8f23a1n ), ...nToU32s( 0x2a04920a8fe8c0an ),

  // 0x18ae848a8f23a1 ? 0x18ae848a8f23a1 (the same)
  ...nToU32s( 0x18ae848a8f23a1n ), ...nToU32s( 0x18ae848a8f23a1n ),

  // -5 ? -7
  ...nToU32s( -5n ), ...nToU32s( -7n ),

  // -5 ? 7
  ...nToU32s( -5n ), ...nToU32s( 7n ),

  // 5 ? -7
  ...nToU32s( 5n ), ...nToU32s( -7n ),

  // -0x18ae848a8f23a1 ? -0x2a04920a8fe8c0a
  ...nToU32s( -0x18ae848a8f23a1n ), ...nToU32s( -0x2a04920a8fe8c0an ),

  // -0x18ae848a8f23a1 ? 0x2a04920a8fe8c0a
  ...nToU32s( -0x18ae848a8f23a1n ), ...nToU32s( 0x2a04920a8fe8c0an ),

  // 0x18ae848a8f23a1 ? -0x2a04920a8fe8c0a
  ...nToU32s( 0x18ae848a8f23a1n ), ...nToU32s( -0x2a04920a8fe8c0an )
], [
  -1, // 5 < 7
  1, // 0xfffffca8 > 0x1234aef
  -1, // 0x18ae848a8f23a1 < 0x2a04920a8fe8c0a
  0, // 0x18ae848a8f23a1 == 0x18ae848a8f23a1
  1, // -5 > -7
  -1, // -5 < 7
  1, // 5 > -7
  1, // -0x18ae848a8f23a1 > -0x2a04920a8fe8c0a
  -1, // -0x18ae848a8f23a1 < 0x2a04920a8fe8c0a
  1 // 0x18ae848a8f23a1 > -0x2a04920a8fe8c0a
], 10, wgsl`
  let in = i * 4u;
  let out = i * 1u;
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
  let b = vec2( input[ in + 2u ], input[ in + 3u ] );
  let c = ${cmp_i64_i64WGSL( wgsl`a`, wgsl`b` )};
  output[ out + 0u ] = c;
` );

testNumeric( 'mul_u64_u64', U32Type, U32Type, [
  // 5 * 7
  ...nToU32s( 5n ), ...nToU32s( 7n ),

  // 0xfffffca8 * 0x1234aef
  ...nToU32s( 0xfffffca8n ), ...nToU32s( 0x1234aefn ),

  // 0x18ae848a8f23a1 * 0x8a04920a8fe8c0a
  ...nToU32s( 0x18ae848a8f23a1n ), ...nToU32s( 0x8a04920a8fe8c0an )
], [
  ...nToU32s( 5n * 7n ),
  ...nToU32s( 0xfffffca8n * 0x1234aefn ),
  ...nToU32s( 0x18ae848a8f23a1n * 0x8a04920a8fe8c0an )
], 3, wgsl`
  let in = i * 4u;
  let out = i * 2u;
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
  let b = vec2( input[ in + 2u ], input[ in + 3u ] );
  let c = ${mul_u64_u64WGSL( wgsl`a`, wgsl`b` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );

testNumeric( 'mul_i64_i64', U32Type, U32Type, [
  // 5 * -7
  ...nToU32s( 5n ), ...nToU32s( -7n ),

  // -0xfffffca8 * -0x1234aef
  ...nToU32s( -0xfffffca8n ), ...nToU32s( -0x1234aefn )
], [
  ...nToU32s( 5n * -7n ),
  ...nToU32s( -0xfffffca8n * -0x1234aefn )
], 2, wgsl`
  let in = i * 4u;
  let out = i * 2u;
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
  let b = vec2( input[ in + 2u ], input[ in + 3u ] );
  let c = ${mul_i64_i64WGSL( wgsl`a`, wgsl`b` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
` );

testNumeric( 'div_u64_u64', U32Type, U32Type, [
  ...nToU32s( 32n ), ...nToU32s( 5n ),
  ...nToU32s( 0xf9fe432c7aca8bfan ), ...nToU32s( 0x583b15971ad94165n ),
  ...nToU32s( 0x19fe432c7aca8bfan ), ...nToU32s( 0x1b5dcn )
], [
  ...nToU32s( 6n ), ...nToU32s( 2n ),
  ...nToU32s( 0xf9fe432c7aca8bfan / 0x583b15971ad94165n ), ...nToU32s( 0xf9fe432c7aca8bfan % 0x583b15971ad94165n ),
  ...nToU32s( 0x19fe432c7aca8bfan / 0x1b5dcn ), ...nToU32s( 0x19fe432c7aca8bfan % 0x1b5dcn )
], 3, wgsl`
  let in = i * 4u;
  let out = i * 4u;
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
  let b = vec2( input[ in + 2u ], input[ in + 3u ] );
  let c = ${div_u64_u64WGSL( wgsl`a`, wgsl`b` )};
    output[ out + 0u ] = c.x;
    output[ out + 1u ] = c.y;
    output[ out + 2u ] = c.z;
    output[ out + 3u ] = c.w;
` );

{
  const gcd0 = 0xa519bc952f7n;
  const a0 = gcd0 * 0x1542n;
  const b0 = gcd0 * 0xa93n; // chosen as relatively prime

  testNumeric( 'gcd_u64_u64', U32Type, U32Type, [
    ...nToU32s( 35n ), ...nToU32s( 10n ),
    ...nToU32s( a0 ), ...nToU32s( b0 )
  ], [
    ...nToU32s( 5n ),
    ...nToU32s( gcd0 )
  ], 2, wgsl`
    let in = i * 4u;
    let out = i * 2u;
    let a = vec2( input[ in + 0u ], input[ in + 1u ] );
    let b = vec2( input[ in + 2u ], input[ in + 3u ] );
    let c = ${gcd_u64_u64WGSL( wgsl`a`, wgsl`b` )};
    output[ out + 0u ] = c.x;
    output[ out + 1u ] = c.y;
  ` );
}

testNumeric( 'i64_to_q128', U32Type, U32Type, [
  ...nToU32s( 32n ), ...nToU32s( 5n ),
  ...nToU32s( -32n ), ...nToU32s( 5n ),
  ...nToU32s( 32n ), ...nToU32s( -5n ),
  ...nToU32s( -32n ), ...nToU32s( -5n ),
  ...nToU32s( 0x19fe432c7aca8bfan ), ...nToU32s( 0x1b5dcn ),
  ...nToU32s( -0x19fe432c7aca8bfan ), ...nToU32s( 0x1b5dcn ),
  ...nToU32s( 0x19fe432c7aca8bfan ), ...nToU32s( -0x1b5dcn ),
  ...nToU32s( -0x19fe432c7aca8bfan ), ...nToU32s( -0x1b5dcn )
], [
  ...nToU32s( 32n ), ...nToU32s( 5n ),
  ...nToU32s( -32n ), ...nToU32s( 5n ),
  ...nToU32s( -32n ), ...nToU32s( 5n ),
  ...nToU32s( 32n ), ...nToU32s( 5n ),
  ...nToU32s( 0x19fe432c7aca8bfan ), ...nToU32s( 0x1b5dcn ),
  ...nToU32s( -0x19fe432c7aca8bfan ), ...nToU32s( 0x1b5dcn ),
  ...nToU32s( -0x19fe432c7aca8bfan ), ...nToU32s( 0x1b5dcn ),
  ...nToU32s( 0x19fe432c7aca8bfan ), ...nToU32s( 0x1b5dcn )
], 8, wgsl`
  let in = i * 4u;
  let out = i * 4u;
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
  let b = vec2( input[ in + 2u ], input[ in + 3u ] );
  let c = ${i64_to_q128WGSL( wgsl`a`, wgsl`b` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
  output[ out + 2u ] = c.z;
  output[ out + 3u ] = c.w;
` );

testNumeric( 'whole_i64_to_q128', U32Type, U32Type, [
  ...nToU32s( 32n ),
  ...nToU32s( -32n ),
  ...nToU32s( 0x19fe432c7aca8bfan ),
  ...nToU32s( -0x19fe432c7aca8bfan )
], [
  ...nToU32s( 32n ), ...nToU32s( 1n ),
  ...nToU32s( -32n ), ...nToU32s( 1n ),
  ...nToU32s( 0x19fe432c7aca8bfan ), ...nToU32s( 1n ),
  ...nToU32s( -0x19fe432c7aca8bfan ), ...nToU32s( 1n )
], 8, wgsl`
  let in = i * 2u;
  let out = i * 4u;
  let a = vec2( input[ in + 0u ], input[ in + 1u ] );
  let c = ${whole_i64_to_q128WGSL( wgsl`a` )};
  output[ out + 0u ] = c.x;
  output[ out + 1u ] = c.y;
  output[ out + 2u ] = c.z;
  output[ out + 3u ] = c.w;
` );

testNumeric( 'equals_cross_mul_q128', U32Type, U32Type, [
  ...nToU32s( 32n ), ...nToU32s( 4n ), ...nToU32s( 32n ), ...nToU32s( 4n ),
  ...nToU32s( 32n ), ...nToU32s( 4n ), ...nToU32s( 16n ), ...nToU32s( 2n ),
  ...nToU32s( 32n ), ...nToU32s( 4n ), ...nToU32s( -32n ), ...nToU32s( 4n ),
  ...nToU32s( 0x11111111n ), ...nToU32s( 0x33333333n ), ...nToU32s( 0x1n ), ...nToU32s( 0x3n ),
  ...nToU32s( 0x11111111n ), ...nToU32s( 0x33333333n ), ...nToU32s( 0x22222222n ), ...nToU32s( 0x66666666n ),
  ...nToU32s( 0x11111111n ), ...nToU32s( 0x33333333n ), ...nToU32s( -0x22222222n ), ...nToU32s( 0x66666666n ),
  ...nToU32s( 0x11111111n ), ...nToU32s( 0x33333333n ), ...nToU32s( 0x33333333n ), ...nToU32s( 0x66666666n )
], [
  1,
  1,
  0,
  1,
  1,
  0,
  0
], 7, wgsl`
  let in = i * 8u;
  let out = i * 1u;
  let a = vec4( input[ in + 0u ], input[ in + 1u ], input[ in + 2u ], input[ in + 3u ] );
  let b = vec4( input[ in + 4u ], input[ in + 5u ], input[ in + 6u ], input[ in + 7u ] );
  let c = select( 0u, 1u, ${equals_cross_mul_q128WGSL( wgsl`a`, wgsl`b` )} );
  output[ out ] = c;
` );

testNumeric( 'ratio_test_q128', U32Type, I32Type, [
  ...nToU32s( 5n ), ...nToU32s( 3n ),
  ...nToU32s( 3n ), ...nToU32s( 3n ),
  ...nToU32s( 2n ), ...nToU32s( 3n ),
  ...nToU32s( 0n ), ...nToU32s( 3n ),
  ...nToU32s( -1n ), ...nToU32s( 3n ),
  ...nToU32s( -4n ), ...nToU32s( 3n ),

  ...nToU32s( 0x7ffffca8n ), ...nToU32s( 0x1234aefn ),
  ...nToU32s( 0x1234aefn ), ...nToU32s( 0x1234aefn ),
  ...nToU32s( 0x234aefn ), ...nToU32s( 0x1234aefn ),
  ...nToU32s( 0n ), ...nToU32s( 0x1234aefn ),
  ...nToU32s( -0x234aefn ), ...nToU32s( 0x1234aefn ),
  ...nToU32s( -0x7ffffca8n ), ...nToU32s( 0x1234aefn )
], [
  0, 1, 2, 1, 0, 0,
  0, 1, 2, 1, 0, 0
], 12, wgsl`
  let in = i * 4u;
  let out = i * 1u;
  let a = vec4( input[ in + 0u ], input[ in + 1u ], input[ in + 2u ], input[ in + 3u ] );
  let c = ${ratio_test_q128WGSL( wgsl`a` )};
  output[ out + 0u ] = c;
` );

{
  // chosen as relatively prime
  const aa = 0x1542n;
  const bb = 0xa93n;
  const gcd0 = 0xa519bc952f7n;

  const a0 = gcd0 * aa;
  const b0 = gcd0 * bb;

  // Ensure these won't overflow
  assert && assert( a0 >> 63n === 0n );
  assert && assert( b0 >> 63n === 0n );

  testNumeric( 'reduce_q128', U32Type, U32Type, [
    // 4 / 12
    ...nToU32s( 4n ), ...nToU32s( 12n ),

    // -32 / 100
    ...nToU32s( -32n ), ...nToU32s( 100n ),

    // 0 / 100
    ...nToU32s( 0n ), ...nToU32s( 100n ),

    ...nToU32s( a0 ), ...nToU32s( b0 )
  ], [
    // 4/12 => 1/3
    ...nToU32s( 1n ), ...nToU32s( 3n ),
    // -32/100 => -8/25
    ...nToU32s( -8n ), ...nToU32s( 25n ),
    // 0/100 => 0/1
    ...nToU32s( 0n ), ...nToU32s( 1n ),

    ...nToU32s( aa ), ...nToU32s( bb )
  ], 4, wgsl`
    let in = i * 4u;
    let out = i * 4u;
    let a = vec4( input[ in + 0u ], input[ in + 1u ], input[ in + 2u ], input[ in + 3u ] );
    let c = ${reduce_q128WGSL( wgsl`a` )};
    output[ out + 0u ] = c.x;
    output[ out + 1u ] = c.y;
    output[ out + 2u ] = c.z;
    output[ out + 3u ] = c.w;
  ` );
}

{
  testNumeric( 'intersect_line_segments', I32Type, U32Type, [
    // an X (diagonal)
    0, 0, 100, 100, 0, 100, 100, 0,

    // overlap (skewed)
    // --------
    //     --------
    0, 0, 100, 200, 50, 100, 150, 300,

    // overlap (skewed)
    //     --------
    // --------
    50, 100, 150, 300, 0, 0, 100, 200,

    // overlap (and horizontal)
    //   ----
    // --------
    25, 0, 75, 0, 0, 0, 100, 0,

    // overlap (and vertical)
    // |
    // | |
    // | |
    // |
    0, 0, 0, 15, 0, 5, 0, 10,

    // no intersection
    0, 0, 40, 50, 0, 100, 100, 0,

    // T intersection
    0, 0, 12, 8, 3, 2, 5, -2
  ], [
    // p0 t0
    ...nToU32s( 1n ), ...nToU32s( 2n ), // 1/2
    // p0 t1
    ...nToU32s( 1n ), ...nToU32s( 2n ), // 1/2
    // p0 px
    ...nToU32s( 50n ), ...nToU32s( 1n ), // 50
    // p0 py
    ...nToU32s( 50n ), ...nToU32s( 1n ), // 50
    // p1 t0
    0, 0, 0, 0,
    // p1 t1
    0, 0, 0, 0,
    // p1 px
    0, 0, 0, 0,
    // p1 py
    0, 0, 0, 0,

    // p0 t0
    ...nToU32s( 1n ), ...nToU32s( 1n ), // 1
    // p0 t1
    ...nToU32s( 1n ), ...nToU32s( 2n ), // 1/2
    // p0 px
    ...nToU32s( 100n ), ...nToU32s( 1n ), // 100
    // p0 py
    ...nToU32s( 200n ), ...nToU32s( 1n ), // 200
    // p1 t0
    ...nToU32s( 1n ), ...nToU32s( 2n ), // 1/2
    // p1 t1
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p1 px
    ...nToU32s( 50n ), ...nToU32s( 1n ), // 50
    // p1 py
    ...nToU32s( 100n ), ...nToU32s( 1n ), // 100

    // p0 t0
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p0 t1
    ...nToU32s( 1n ), ...nToU32s( 2n ), // 1/2
    // p0 px
    ...nToU32s( 50n ), ...nToU32s( 1n ), // 50
    // p0 py
    ...nToU32s( 100n ), ...nToU32s( 1n ), // 100
    // p1 t0
    ...nToU32s( 1n ), ...nToU32s( 2n ), // 1/2
    // p1 t1
    ...nToU32s( 1n ), ...nToU32s( 1n ), // 1
    // p1 px
    ...nToU32s( 100n ), ...nToU32s( 1n ), // 100
    // p1 py
    ...nToU32s( 200n ), ...nToU32s( 1n ), // 200

    // p0 t0
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p0 t1
    ...nToU32s( 1n ), ...nToU32s( 4n ), // 1/4
    // p0 px
    ...nToU32s( 25n ), ...nToU32s( 1n ), // 25
    // p0 py
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p1 t0
    ...nToU32s( 1n ), ...nToU32s( 1n ), // 1
    // p1 t1
    ...nToU32s( 3n ), ...nToU32s( 4n ), // 3/4
    // p1 px
    ...nToU32s( 75n ), ...nToU32s( 1n ), // 75
    // p1 py
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0

    // p0 t0
    ...nToU32s( 1n ), ...nToU32s( 3n ), // 1/3
    // p0 t1
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p0 px
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p0 py
    ...nToU32s( 5n ), ...nToU32s( 1n ), // 5
    // p1 t0
    ...nToU32s( 2n ), ...nToU32s( 3n ), // 2/3
    // p1 t1
    ...nToU32s( 1n ), ...nToU32s( 1n ), // 1
    // p1 px
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p1 py
    ...nToU32s( 10n ), ...nToU32s( 1n ), // 10

    // p0 t0
    0, 0, 0, 0,
    // p0 t1
    0, 0, 0, 0,
    // p0 px
    0, 0, 0, 0,
    // p0 py
    0, 0, 0, 0,
    // p1 t0
    0, 0, 0, 0,
    // p1 t1
    0, 0, 0, 0,
    // p1 px
    0, 0, 0, 0,
    // p1 py
    0, 0, 0, 0,

    // p0 t0
    ...nToU32s( 1n ), ...nToU32s( 4n ), // 1/4
    // p0 t1
    ...nToU32s( 0n ), ...nToU32s( 1n ), // 0
    // p0 px
    ...nToU32s( 3n ), ...nToU32s( 1n ), // 3
    // p0 py
    ...nToU32s( 2n ), ...nToU32s( 1n ), // 2
    // p1 t0
    0, 0, 0, 0,
    // p1 t1
    0, 0, 0, 0,
    // p1 px
    0, 0, 0, 0,
    // p1 py
    0, 0, 0, 0
  ], 7, wgsl`
    let in = i * 8u;
    let out = i * 32u;
    let p0 = vec2( input[ in + 0u ], input[ in + 1u ] );
    let p1 = vec2( input[ in + 2u ], input[ in + 3u ] );
    let p2 = vec2( input[ in + 4u ], input[ in + 5u ] );
    let p3 = vec2( input[ in + 6u ], input[ in + 7u ] );
    let c = ${intersect_line_segmentsWGSL( wgsl`p0`, wgsl`p1`, wgsl`p2`, wgsl`p3` )};
    output[ out + 0u ] = c.p0.t0.x;
    output[ out + 1u ] = c.p0.t0.y;
    output[ out + 2u ] = c.p0.t0.z;
    output[ out + 3u ] = c.p0.t0.w;
    output[ out + 4u ] = c.p0.t1.x;
    output[ out + 5u ] = c.p0.t1.y;
    output[ out + 6u ] = c.p0.t1.z;
    output[ out + 7u ] = c.p0.t1.w;
    output[ out + 8u ] = c.p0.px.x;
    output[ out + 9u ] = c.p0.px.y;
    output[ out + 10u ] = c.p0.px.z;
    output[ out + 11u ] = c.p0.px.w;
    output[ out + 12u ] = c.p0.py.x;
    output[ out + 13u ] = c.p0.py.y;
    output[ out + 14u ] = c.p0.py.z;
    output[ out + 15u ] = c.p0.py.w;
    output[ out + 16u ] = c.p1.t0.x;
    output[ out + 17u ] = c.p1.t0.y;
    output[ out + 18u ] = c.p1.t0.z;
    output[ out + 19u ] = c.p1.t0.w;
    output[ out + 20u ] = c.p1.t1.x;
    output[ out + 21u ] = c.p1.t1.y;
    output[ out + 22u ] = c.p1.t1.z;
    output[ out + 23u ] = c.p1.t1.w;
    output[ out + 24u ] = c.p1.px.x;
    output[ out + 25u ] = c.p1.px.y;
    output[ out + 26u ] = c.p1.px.z;
    output[ out + 27u ] = c.p1.px.w;
    output[ out + 28u ] = c.p1.py.x;
    output[ out + 29u ] = c.p1.py.y;
    output[ out + 30u ] = c.p1.py.z;
    output[ out + 31u ] = c.p1.py.w;
  ` );
}