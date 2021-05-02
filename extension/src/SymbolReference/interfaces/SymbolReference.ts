/* eslint-disable @typescript-eslint/naming-convention */
// Generated by https://quicktype.io
//
// To change quicktype's target language, run command:
//
//   "Set quicktype target language"

import { LanguageConfiguration } from "vscode";

export interface SymbolReference {
    Tables: TableDefinition[];
    Codeunits: CodeunitDefinition[];
    Pages: PageDefinition[];
    PageExtensions: PageExtensionDefinition[];
    TableExtensions: TableExtensionDefinition[];
    Reports: ReportDefinition[];
    XmlPorts: XmlPortDefinition[];
    EnumTypes: EnumTypeDefinition[];
    EnumExtensionTypes: EnumExtensionTypeDefinition[];
    Interfaces: InterfaceDefinition[];
    Profiles: ProfileDefinition[];
    PageCustomizations: PageCustomizationDefinition[];
    Queries: any[];
    ProfileExtensions: any[];
    ControlAddIns: any[];
    DotNetPackages: any[];
    PermissionSets: any[];
    PermissionSetExtensions: any[];
    ReportExtensions: any[];
    InternalsVisibleToModules: SymbolInternalsVisibleToModule[];
    AppId: string;
    Name: string;
    Publisher: string;
    Version: string;
}

interface PageCustomizationDefinition extends LanguageElement {
    ActionChanges?: ExtensionActionDefinition[];
    ControlChanges?: ExtensionControlDefinition[];
    ReferenceSourceFileName: string;
    TargetObject: string;
    ViewChanges?: ExtensionViewDefinition[];
}
interface CodeunitDefinition {
    Methods?: MethodDefinition[];
    ReferenceSourceFileName: string;
    Properties?: SymbolProperty[];
    Id: number;
    Name: string;
    Variables?: CodeunitVariable[];
    ImplementedInterfaces?: string[];
    Attributes?: AttributeDefinition[];
}


interface MethodDefinition extends LanguageElement {
    Attributes?: AttributeDefinition[];
    IsInternal?: boolean;
    IsLocal?: boolean;
    IsProtected?: boolean;
    MethodKind: MethodKind;
    Parameters: ParameterDefinition[];
    ReturnTypeDefinition: TypeDefinition;
}

interface AttributeDefinition {
    Arguments: AttributeArgumentDefinition[];
    Name: string;
}

interface AttributeArgumentDefinition {
    Value: string;
}


interface ParameterDefinition {
    ArrayDimensions: string;
    IsVar?: boolean;
    Name: string;
    OptionMembers: string;
    Subtype?: Subtype;
    Type: string;
    TypeDefinition: TypeDefinition;
}

interface TypeDefinition {
    ArrayDimensions?: number[];
    Name: string;
    OptionMembers?: string[];
    Subtype: Subtype;
    Temporary: boolean;
    TypeArguments?: TypeDefinition[];
}

interface Subtype {
    Id?: number;
    IsEmpty: boolean;
    Name: string;
}

export interface SymbolProperty {
    Value: string;
    Name: string;
}

interface CodeunitVariable {
    TypeDefinition: TypeDefinition;
    Protected: boolean;
    Name: string;
    Attributes?: AttributeDefinition[];
}


interface InterfaceDefinition extends LanguageElementWithProperties {
    Methods?: MethodDefinition[];
    ReferenceSourceFileName: string;
}

enum MethodKind {
    Method,
    Trigger,
    BuiltInMethod,
    BuiltInOperator,
    Property,
    DeclareMethod,
    EventTrigger
}
interface SymbolInternalsVisibleToModule {
    AppId: string;
    Name: string;
    Publisher: string;
}

interface PageExtensionDefinition extends LanguageElement {
    ActionChanges?: ExtensionActionDefinition[];
    ControlChanges?: ExtensionControlDefinition[];
    Methods?: MethodDefinition[]
    ReferenceSourceFileName: string;
    TargetObject: string;
    Variables?: VariableDefinition[];
    ViewChanges?: ExtensionViewDefinition[];
}

interface ExtensionViewDefinition {
    Anchor: string;
    ChangeKind: ChangeKind;
    Views?: ViewDefinition[];
}
interface ExtensionActionDefinition {
    Actions?: ActionDefinition[];
    Anchor: string;
    ChangeKind: ChangeKind;
}

export enum ActionKind {
    Area,
    Group,
    Action,
    Separator
}

interface ActionDefinition extends LanguageElementWithProperties {
    Actions?: ActionDefinition[];
    Kind: ActionKind;
}
export interface ControlDefinition extends LanguageElementWithProperties {
    Actions?: ActionDefinition[];
    Controls?: ControlDefinition[];
    Kind: ControlKind;
    RelatedControlAddIn?: string;
    RelatedPagePartId?: Subtype;
    Type: string;
    TypeDefinition: ActionTypeDefinition;
}

export enum ControlKind {
    Area,
    Group,
    CueGroup,
    Repeater,
    Fixed,
    Grid,
    Part,
    SystemPart,
    Field,
    Label,
    UserControl,
    ChartPart
}
export enum ControlElementKind {
    Area,
    Group,
    CueGroup,
    Repeater,
    Fixed,
    Grid,
    Part,
    SystemPart,
    Field,
    Label,
    UserControl,
    ChartPart
}
interface FieldDefinition extends LanguageElementWithProperties {
    Methods: MethodDefinition[];
    OptionMembers: string;
    Type: string;
    TypeDefinition: TypeDefinition;
}


interface ActionTypeDefinition {
    Name: string;
    Temporary: boolean;
    OptionMembers?: string[];
    Subtype?: Subtype;
}

interface ExtensionControlDefinition extends LanguageElementWithProperties {
    Anchor: string;
    ChangeKind: ChangeKind;
    Controls?: ControlDefinition[];
}
enum ChangeKind {
    Add,
    AddFirst,
    AddLast,
    AddBefore,
    AddAfter,
    MoveFirst,
    MoveLast,
    MoveBefore,
    MoveAfter,
    Modify
}

interface VariableDefinition extends LanguageElement {
    ArrayDimensions: string;
    Attributes: AttributeDefinition[];
    OptionMembers: string;
    Protected: boolean;
    Subtype: Subtype;
    Type: string;
    TypeDefinition: TypeDefinition;
}
interface LanguageElementWithProperties extends LanguageElement {
    Properties: SymbolProperty[];
}
interface LanguageElement {
    Id?: number;
    Name: string;
}
export interface PageDefinition extends LanguageElementWithProperties {
    Actions?: ActionDefinition[];
    Controls?: ControlDefinition[];
    Methods?: MethodDefinition[];
    ReferenceSourceFileName: string;
    Variables?: CodeunitVariable[];
    views?: ViewDefinition[];
}
interface ViewDefinition extends LanguageElementWithProperties {
    ControlChanges?: ExtensionControlDefinition[];
}

interface ProfileDefinition extends LanguageElementWithProperties {
    ReferenceSourceFileName: string;
}

interface ReportDefinition extends LanguageElementWithProperties {
    DataItems?: ReportDataItemDefinition[];
    Labels?: ReportLabelDefinition[];
    Methods?: MethodDefinition[];
    ReferenceSourceFileName: string;
    RequestPage?: RequestPageDefinition;
    Variables?: VariableDefinition[];
}
interface ReportLabelDefinition extends LanguageElement {
    IsMultilanguageReportLabel: boolean;
}

interface ReportDataItemDefinition extends LanguageElementWithProperties {
    Columns: ReportColumnDefinition[];
    DataItems: ReportDataItemDefinition[];
    Indentation: number;
    OwningDataItemName: string;
    RelatedTable: string;

}
interface ReportColumnDefinition extends LanguageElementWithProperties {
    Indentation: number;
    OwningDataItemName: string;
    RelatedTableField: string;
    TypeDefinition: TypeDefinition;
}

interface TableExtensionDefinition extends TableDefinition {
    TargetObject: string;
}

export interface TableDefinition extends LanguageElementWithProperties {
    DefinedEnums: EnumTypeDefinition[];
    FieldGroups?: FieldGroupDefinition[];
    Fields?: FieldDefinition[];
    Keys: KeyDefinition[];
    Methods?: MethodDefinition[];
    ReferenceSourceFileName: string;
    Variables?: VariableDefinition[];
}
interface EnumTypeDefinition extends LanguageElementWithProperties {
    ImplementedInterfaces?: string;
    ReferenceSourceFileName: string;
    Values?: EnumValueDefinition[];
}
interface EnumValueDefinition extends LanguageElementWithProperties {
    Ordinal: number;
}
interface EnumExtensionTypeDefinition extends EnumTypeDefinition {
    TargetObject: string;
}
interface FieldGroupDefinition extends LanguageElementWithProperties {
    FieldNames: string[];
}

interface KeyDefinition extends LanguageElementWithProperties {
    FieldNames: string[];
}


interface XmlPortDefinition extends LanguageConfiguration {
    Methods: MethodDefinition[];
    ReferenceSourceFileName: string;
    RequestPage: RequestPageDefinition;
    Variables?: VariableDefinition[];
}

interface RequestPageDefinition extends LanguageElementWithProperties {
    Actions?: ActionDefinition[];
    Controls?: ControlDefinition[];
    Methods?: MethodDefinition[];
    Variables?: VariableDefinition[];
}