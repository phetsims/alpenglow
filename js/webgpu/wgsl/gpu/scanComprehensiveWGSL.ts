// Copyright 2023, University of Colorado Boulder

/**
 * All of the needed logic for a raked workgroup scan (including the logic to load and store the data).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { alpenglow, BinaryOp, coalescedLoopWGSL, coalescedLoopWGSLOptions, commentWGSL, loadMultipleWGSL, loadMultipleWGSLOptions, scanRakedWGSL, scanRakedWGSLOptions, WGSLContext, WGSLExpressionU32, WGSLStatements, WGSLVariableName } from '../../../imports.js';
import { optionize3 } from '../../../../../phet-core/js/optionize.js';

export type scanComprehensiveWGSLOptions<T> = {
  // varname of input var<storage> array<{valueType}>
  input: WGSLVariableName;

  // varname of output var<storage> array<{valueType}> (can be the same as the input)
  output: WGSLVariableName;

  // varname of output var<workgroup> array<${valueType}, ${workgroupSize * grainSize}>
  scratch: WGSLVariableName;

  binaryOp: BinaryOp<T>;

  // the number of threads running this command
  workgroupSize: number;

  // the number of elements each thread should process
  grainSize: number;

  exclusive?: boolean; // TODO: consider just requiring this everywhere

  // if provided, it will enable range checks (based on the inputOrder)
  lengthExpression?: WGSLExpressionU32 | null;

  // null | ( varName ) => statements - should write a value to be added to everything into the specific variable name
  // This is designed to be used for multi-level scans, where you essentially want to add an "offset" value to
  // everything in the workgroup.
  getAddedValue?: ( ( varName: WGSLVariableName ) => WGSLStatements ) | null;
} & Pick<scanRakedWGSLOptions<T>, 'storeReduction' | 'stripeReducedOutput' | 'addedValueNeedsWorkgroupBarrier' | 'workgroupIndex' | 'localIndex'>
  & Pick<loadMultipleWGSLOptions<T>, 'factorOutSubexpressions' | 'inputOrder' | 'inputAccessOrder' | 'globalIndex' | 'workgroupIndex' | 'localIndex'>
  & Pick<coalescedLoopWGSLOptions, 'workgroupIndex' | 'localIndex'>;
// TODO: isolate out SelfOptions

type SelfOptions<T> = Pick<scanComprehensiveWGSLOptions<T>, 'input' | 'output' | 'scratch' | 'exclusive' | 'getAddedValue' | 'binaryOp'>;

const DEFAULT_OPTIONS = {
  exclusive: false,
  getAddedValue: null,
  lengthExpression: null
} as const;

const scanComprehensiveWGSL = <T>(
  context: WGSLContext,
  providedOptions: scanComprehensiveWGSLOptions<T>
): WGSLStatements => {

  // TODO: how to specify that we don't fill in defaults for things like factorOutSubexpressions?
  const options = optionize3<scanComprehensiveWGSLOptions<T>, SelfOptions<T>>()( {}, DEFAULT_OPTIONS, providedOptions );

  const input = options.input;
  const output = options.output;
  const scratch = options.scratch;
  const exclusive = options.exclusive;
  const getAddedValue = options.getAddedValue;
  const binaryOp = options.binaryOp;

  return `
    ${commentWGSL( 'begin scan_comprehensive' )}

    // Load into workgroup memory
    ${loadMultipleWGSL( {
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
    
    ${scanRakedWGSL( {
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
    ${coalescedLoopWGSL( {
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
