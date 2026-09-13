using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace STS.Migrations
{
    /// <inheritdoc />
    public partial class AddStsUpdateDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "NextActionDate",
                table: "SalesRecords",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CallMeetingDate",
                table: "DsrEntries",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CcTo",
                table: "DsrEntries",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "NextCallMeetingDate",
                table: "DsrEntries",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Priority",
                table: "DsrEntries",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Subject",
                table: "DsrEntries",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NextActionDate",
                table: "SalesRecords");

            migrationBuilder.DropColumn(
                name: "CallMeetingDate",
                table: "DsrEntries");

            migrationBuilder.DropColumn(
                name: "CcTo",
                table: "DsrEntries");

            migrationBuilder.DropColumn(
                name: "NextCallMeetingDate",
                table: "DsrEntries");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "DsrEntries");

            migrationBuilder.DropColumn(
                name: "Subject",
                table: "DsrEntries");
        }
    }
}
