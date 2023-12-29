// Copyright 2023, University of Colorado Boulder

/**
 * All of the needed logic for a raked workgroup scan (including the logic to load and store the data).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BinaryOp, coalescedLoopWGSL, commentWGSL, GlobalIndexable, loadMultipleWGSL, loadMultipleWGSLOptions, LocalIndexable, OptionalLengthExpressionable, RakedSizable, scanRakedWGSL, scanRakedWGSLOptions, PipelineBlueprint, WGSLStatements, WGSLVariableName, WorkgroupIndexable } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

type SelfOptions<T> = {
  // varname of input var<storage> array<{valueType}>
  input: WGSLVariableName;

  // varname of output var<storage> array<{valueType}> (can be the same as the input)
  output: WGSLVariableName;

  // varname of output var<workgroup> array<${valueType}, ${workgroupSize * grainSize}>
  scratch: WGSLVariableName;

  binaryOp: BinaryOp<T>;

  exclusive?: boolean; // TODO: consider just requiring this everywhere

  // null | ( varName ) => statements - should write a value to be added to everything into the specific variable name
  // This is designed to be used for multi-level scans, where you essentially want to add an "offset" value to
  // everything in the workgroup.
  getAddedValue?: ( ( varName: WGSLVariableName ) => WGSLStatements ) | null;
};

export type scanComprehensiveWGSLOptions<T> = SelfOptions<T>
  & RakedSizable & OptionalLengthExpressionable & GlobalIndexable & WorkgroupIndexable & LocalIndexable
  & Pick<scanRakedWGSLOptions<T>, 'storeReduction' | 'stripeReducedOutput' | 'addedValueNeedsWorkgroupBarrier'>
  & Pick<loadMultipleWGSLOptions<T>, 'factorOutSubexpressions' | 'inputOrder' | 'inputAccessOrder'>;

export const SCAN_COMPREHENSIVE_DEFAULTS = {
  exclusive: false,
  getAddedValue: null
} as const;

const scanComprehensiveWGSL = <T>(
  blueprint: PipelineBlueprint,
  providedOptions: scanComprehensiveWGSLOptions<T>
): WGSLStatements => {

  // TODO: how to specify that we don't fill in defaults for things like factorOutSubexpressions?
  const options = optionize3<scanComprehensiveWGSLOptions<T>, SelfOptions<T>>()( {}, SCAN_COMPREHENSIVE_DEFAULTS, providedOptions );

  const input = options.input;
  const output = options.output;
  const scratch = options.scratch;
  const exclusive = options.exclusive;
  const getAddedValue = options.getAddedValue;
  const binaryOp = options.binaryOp;

  return `
    ${commentWGSL( 'begin scan_comprehensive' )}

    // Load into workgroup memory
    ${loadMultipleWGSL( blueprint, {
      loadExpression: index => `${input}[ ${index} ]`,
      storeStatements: ( index, value ) => `${scratch}[ ${index} ] = ${value};`,
      workgroupSize: options.workgroupSize,
      grainSize: options.grainSize,
      type: binaryOp.type,
      lengthExpression: options.lengthExpression,
      globalIndex: options.globalIndex,
      workgroupIndex: options.workgroupIndex,
      localIndex: options.localIndex,
      outOfRangeValue: binaryOp.identityWGSL,
      inputOrder: options.inputOrder,
      inputAccessOrder: options.inputAccessOrder,
      factorOutSubexpressions: options.factorOutSubexpressions
    } )}

    workgroupBarrier();
    
    ${scanRakedWGSL( blueprint, {
      // TODO: we're missing error checking here? Use optionize3?
      scratch: scratch,
      binaryOp: binaryOp,
      workgroupSize: options.workgroupSize,
      grainSize: options.grainSize,
      workgroupIndex: options.workgroupIndex,
      localIndex: options.localIndex,
      exclusive: exclusive,
      getAddedValue: getAddedValue,
      addedValueNeedsWorkgroupBarrier: options.addedValueNeedsWorkgroupBarrier,
      storeReduction: options.storeReduction,
      stripeReducedOutput: options.stripeReducedOutput
    } )}

    workgroupBarrier();

    // Write our output in a coalesced order.
    ${commentWGSL( 'begin (output write)' )}
    ${coalescedLoopWGSL( blueprint, {
      workgroupSize: options.workgroupSize,
      grainSize: options.grainSize,
      lengthExpression: options.lengthExpression,
      workgroupIndex: options.workgroupIndex,
      localIndex: options.localIndex,
      callback: ( localIndex, dataIndex ) => `
        ${output}[ ${dataIndex} ] = ${exclusive ? `select( ${getAddedValue ? 'workgroup_added_value' : binaryOp.identityWGSL}, ${scratch}[ ${localIndex} - 1u ], ${localIndex} > 0u )` : `${scratch}[ ${localIndex} ]`};
      `
    } )}
    ${commentWGSL( 'end (output write)' )}

    ${commentWGSL( 'end scan_comprehensive' )}
  `;
};

export default scanComprehensiveWGSL;

alpenglow.register( 'scanComprehensiveWGSL', scanComprehensiveWGSL );
