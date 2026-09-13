using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace STS.Migrations
{
    /// <inheritdoc />
    public partial class ExpandSalesDataModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Address1",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Address2",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "BusinessDescription",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ContactPerson",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Country",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Designation",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Fax",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "LastActionDate",
                table: "SalesRecords",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LeadBy",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "MarketingExecutiveId",
                table: "SalesRecords",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Mobile1",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Mobile2",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "OpeningComments",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Priority",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "State",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "TeleExecutiveId",
                table: "SalesRecords",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Website",
                table: "SalesRecords",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_SalesRecords_MarketingExecutiveId",
                table: "SalesRecords",
                column: "MarketingExecutiveId");

            migrationBuilder.CreateIndex(
                name: "IX_SalesRecords_TeleExecutiveId",
                table: "SalesRecords",
                column: "TeleExecutiveId");

            migrationBuilder.AddForeignKey(
                name: "FK_SalesRecords_Users_MarketingExecutiveId",
                table: "SalesRecords",
                column: "MarketingExecutiveId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_SalesRecords_Users_TeleExecutiveId",
                table: "SalesRecords",
                column: "TeleExecutiveId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SalesRecords_Users_MarketingExecutiveId",
                table: "SalesRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_SalesRecords_Users_TeleExecutiveId",
                table: "SalesRecords");

            migrationBuilder.DropIndex(
                name: "IX_SalesRecords_MarketingExecutiveId",
                table: "SalesRecords");

            migrationBuilder.DropIndex(
                name: "IX_SalesRecords_TeleExecutiveId",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "Address1",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "Address2",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "BusinessDescription",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "ContactPerson",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "Country",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "Designation",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "Fax",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "LastActionDate",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "LeadBy",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "MarketingExecutiveId",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "Mobile1",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "Mobile2",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "OpeningComments",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "State",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "TeleExecutiveId",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "Website",
                table: "SalesRecords");
        }
    }
}
