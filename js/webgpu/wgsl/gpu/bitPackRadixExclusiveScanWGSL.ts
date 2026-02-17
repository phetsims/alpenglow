// Copyright 2023-2025, University of Colorado Boulder

/**
 * Performs a serial exclusive scan (prefix sum) on a bit-packed histogram. See bit_pack_radix_access for more documentation.
 *
 * @author Jonathan Olson (PhET Interactive Simulations)
 */

import { alpenglow } from '../../../alpenglow.js';
import { u32HexS, u32S, wgsl, WGSLExpressionU32, WGSLStatements, wgslString, WGSLStringAccumulator, WGSLVariableName } from '../WGSLString.js';
import { commentWGSL } from './commentWGSL.js';

export type bitPackRadixExclusiveScanWGSLOptions = {
  // (u32/vec2u/vec3u/vec4u) name
  bitVector: WGSLVariableName;

  // TODO: once this is working, form it into a larger object of settings for Radix handling
  // e.g. 2 for a two-bit sort
  bitsPerInnerPass: number;

  // (1/2/3/4) for (u32/vec2u/vec3u/vec4u) e.g. 4 for a vec4u
  bitVectorSize: number;

  // the maximum count in the histogram
  maxCount: number;
};

export const bitPackRadixExclusiveScanWGSL = (
  options: bitPackRadixExclusiveScanWGSLOptions
): WGSLStatements => {

  const bitVector = options.bitVector;
  const bitsPerInnerPass = options.bitsPerInnerPass;
  const bitVectorSize = options.bitVectorSize;
  const maxCount = options.maxCount;

  const countBitQuantity = Math.ceil( Math.log2( maxCount ) );
  const countsPerComponent = Math.floor( 32 / countBitQuantity );
  assert && assert( bitVectorSize * countsPerComponent >= ( 1 << bitsPerInnerPass ), 'Not enough space for bit-packing' );

  if ( countsPerComponent === 1 ) {
    switch( bitVectorSize ) {
      case 1:
        return wgsl`${bitVector} = 0u;`;
      case 2:
        return wgsl`${bitVector} = vec2( 0u, ${bitVector}.x );`;
      case 3:
        return wgsl`${bitVector} = vec3( 0u, ${bitVector}.x, ${bitVector}.y );`;
      case 4:
        return wgsl`${bitVector} = vec4( 0u, ${bitVector}.x, ${bitVector}.y, ${bitVector}.z );`;
      default:
        throw new Error( `Invalid bitVectorSize: ${bitVectorSize}` );
    }
  }
  else {
    const singleMask = ( ( 1 << countBitQuantity ) >>> 0 ) - 1;
    const fullMask = 0xffffffff;
    const getFromIndex = ( index: number ): WGSLExpressionU32 => {
      const vectorIndexExpr = wgslString( bitVectorSize > 1 ? [ '.x', '.y', '.z', '.w' ][ Math.floor( index / countsPerComponent ) ] : '' );
      let expr = wgsl`${bitVector}${vectorIndexExpr}`;
      const shiftAmount = countBitQuantity * ( index % countsPerComponent );
      if ( shiftAmount > 0 ) {
        expr = wgsl`( ${expr} >> ${u32S( shiftAmount )} )`;
      }
      return wgsl`${expr} & ${u32HexS( singleMask )}`;
    };
    const setAtIndex = ( index: number, value: WGSLVariableName ): WGSLStatements => {
      const vectorIndexExpr = wgslString( bitVectorSize > 1 ? [ '.x', '.y', '.z', '.w' ][ Math.floor( index / countsPerComponent ) ] : '' );
      const accessExpr = wgsl`${bitVector}${vectorIndexExpr}`;
      const shiftAmount = countBitQuantity * ( index % countsPerComponent );
      const existingMask = fullMask - ( ( singleMask << shiftAmount ) >>> 0 );
      const shiftedValueExpr = shiftAmount === 0 ? value : wgsl`( ( ${value} ) << ${u32S( shiftAmount )} )`;
      return wgsl`${accessExpr} = ( ${accessExpr} & ${u32HexS( existingMask )} ) | ${shiftedValueExpr}`;
    };

    const str = new WGSLStringAccumulator();

    str.add( wgsl`
      var bitty_value = 0u;
      var bitty_next_value = 0u;
    ` );
    const numBins = ( 1 << bitsPerInnerPass ) >>> 0;
    for ( let i = 0; i < numBins; i++ ) {
      const isLast = i === numBins - 1;

      if ( !isLast ) {
        str.add( wgsl`bitty_next_value += ${getFromIndex( i )};\n` );
      }
      str.add( wgsl`${setAtIndex( i, wgsl`bitty_value` )};\n` );
      if ( !isLast ) {
        str.add( wgsl`bitty_value = bitty_next_value;\n` );
      }
    }
    return wgsl`
      ${commentWGSL( 'begin bit_pack_radix_exclusive_scan' )}
      ${str}
      ${commentWGSL( 'end bit_pack_radix_exclusive_scan' )}
    `;
  }
};

alpenglow.register( 'bitPackRadixExclusiveScanWGSL', bitPackRadixExclusiveScanWGSL );