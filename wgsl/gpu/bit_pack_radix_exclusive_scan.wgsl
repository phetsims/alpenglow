// Copyright 2023, University of Colorado Boulder

/**
 * Performs a serial exclusive scan (prefix sum) on a bit-packed histogram. See bit_pack_radix_access for more documentation.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

${template( ( {
  bitVector, // (u32/vec2u/vec3u/vec4u) name
  bitQuantity, // e.g. 2 for a two-bit sort
  bitVectorSize, // (1/2/3/4) for (u32/vec2u/vec3u/vec4u) e.g. 4 for a vec4u
  maxCount, // the maximum count in the histogram
} ) => {
  const countBitQuantity = Math.ceil( Math.log2( maxCount ) );
  const countsPerComponent = Math.floor( 32 / countBitQuantity );
  assert && assert( bitVectorSize * countsPerComponent >= bitQuantity, 'Not enough space for bit-packing' );

  if ( countsPerComponent === 1 ) {
    switch( bitVectorSize ) {
      case 1:
        return `${bitVector} = 0u;`;
      case 2:
        return `${bitVector} = vec2( 0u, ${bitVector}.x );`;
      case 3:
        return `${bitVector} = vec3( 0u, ${bitVector}.x, ${bitVector}.y );`;
      case 4:
        return `${bitVector} = vec4( 0u, ${bitVector}.x, ${bitVector}.y, ${bitVector}.z );`;
    }
  }
  else {
    const singleMask = ( ( 1 << countBitQuantity ) >>> 0 ) - 1;
    const fullMask = 0xffffffff;
    const getFromIndex = index => {
      const vectorIndexExpr = bitVectorSize > 1 ? [ '.x', '.y', '.z', '.w' ][ Math.floor( index / countsPerComponent ) ] : ``;
      let expr = `${bitVector}${vectorIndexExpr}`;
      const shiftAmount = countBitQuantity * ( index % countsPerComponent );
      if ( shiftAmount > 0 ) {
        expr = `( ${expr} >> ${u32( shiftAmount )} )`;
      }
      return `${expr} & ${u32Hex( singleMask )}`;
    };
    const setAtIndex = ( index, value ) => {
      const vectorIndexExpr = bitVectorSize > 1 ? [ '.x', '.y', '.z', '.w' ][ Math.floor( index / countsPerComponent ) ] : ``;
      const accessExpr = `${bitVector}${vectorIndexExpr}`;
      const shiftAmount = countBitQuantity * ( index % countsPerComponent );
      const existingMask = fullMask - ( ( singleMask << shiftAmount ) >>> 0 );
      const shiftedValueExpr = shiftAmount === 0 ? value : `( ( ${value} ) << ${u32( shiftAmount )} )`;
      return `${accessExpr} = ( ${accessExpr} & ${u32Hex( existingMask )} ) | ${shiftedValueExpr}`;
    };
    let str = `
      var bitty_value = 0u;
      var bitty_next_value = 0u;
    `;
    const numBins = ( 1 << bitQuantity ) >>> 0;
    for ( let i = 0; i < numBins; i++ ) {
      const isLast = i === numBins - 1;

      if ( !isLast ) {
        str += `bitty_next_value += ${getFromIndex( i )};\n`;
      }
      str += `${setAtIndex( i, 'bitty_value' )};\n`;
      if ( !isLast ) {
        str += `bitty_value = bitty_next_value;\n`;
      }
    }
    return str;
  }
} )}
